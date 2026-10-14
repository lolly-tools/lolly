// SPDX-License-Identifier: MPL-2.0
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

const FILE_CAP: u64 = 256 * 1024 * 1024;

fn regular(file: File) -> Result<File, String> {
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() > FILE_CAP {
        return Err("The delivered file is not a regular file within the read limit.".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err("Linked files cannot be delivered.".into());
        }
    }
    Ok(file)
}

pub(crate) fn open_delivered(path: &Path) -> Result<File, String> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK | libc::O_CLOEXEC);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x00200000);
    }
    regular(options.open(path).map_err(|e| e.to_string())?)
}

pub(crate) fn read_delivered(file: &mut File) -> Result<Vec<u8>, String> {
    if file.metadata().map_err(|e| e.to_string())?.len() > FILE_CAP {
        return Err("The delivered file exceeds the read limit.".into());
    }
    file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.take(FILE_CAP + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > FILE_CAP {
        return Err("The delivered file exceeds the read limit.".into());
    }
    Ok(bytes)
}

pub(crate) struct DirectoryGrant {
    pub path: PathBuf,
    directory: File,
}
impl DirectoryGrant {
    pub(crate) fn open(path: &Path) -> Result<Self, String> {
        let path = path.canonicalize().map_err(|e| e.to_string())?;
        #[cfg(unix)]
        let directory = open_directory_components(&path)?;
        #[cfg(windows)]
        let directory = {
            use std::os::windows::fs::OpenOptionsExt;
            OpenOptions::new()
                .read(true)
                .custom_flags(0x02000000 | 0x00200000)
                .open(&path)
                .map_err(|e| e.to_string())?
        };
        #[cfg(not(any(unix, windows)))]
        let directory = File::open(&path).map_err(|e| e.to_string())?;
        if !directory.metadata().map_err(|e| e.to_string())?.is_dir() {
            return Err("Select a directory for the hot folder.".into());
        }
        Ok(Self { path, directory })
    }
    pub(crate) fn open_child(&self, path: &Path) -> Result<File, String> {
        if path.parent() != Some(self.path.as_path()) {
            return Err("The file is outside the selected folder.".into());
        }
        let name = path.file_name().ok_or("The file has no name.")?;
        #[cfg(unix)]
        {
            use std::os::unix::{
                ffi::OsStrExt,
                io::{AsRawFd, FromRawFd},
            };
            let name = std::ffi::CString::new(name.as_bytes()).map_err(|e| e.to_string())?;
            let fd = unsafe {
                libc::openat(
                    self.directory.as_raw_fd(),
                    name.as_ptr(),
                    libc::O_RDONLY | libc::O_NOFOLLOW | libc::O_NONBLOCK | libc::O_CLOEXEC,
                )
            };
            if fd < 0 {
                return Err(std::io::Error::last_os_error().to_string());
            }
            regular(unsafe { File::from_raw_fd(fd) })
        }
        #[cfg(windows)]
        {
            let _ = name;
            let parent = DirectoryGrant::open(&self.path)?;
            if windows_identity(&parent.directory)? != windows_identity(&self.directory)? {
                return Err("The selected directory changed.".into());
            }
            let file = open_delivered(path)?;
            if windows_final_path(&file)?
                != windows_final_path(&self.directory)?.join(path.file_name().unwrap())
            {
                return Err("The file is outside the selected folder.".into());
            }
            let after = DirectoryGrant::open(&self.path)?;
            if windows_identity(&after.directory)? != windows_identity(&self.directory)? {
                return Err("The selected directory changed.".into());
            }
            Ok(file)
        }
        #[cfg(not(any(unix, windows)))]
        {
            let _ = name;
            Err("Hot-folder file custody is unavailable on this platform.".into())
        }
    }
}

#[cfg(unix)]
fn open_directory_components(path: &Path) -> Result<File, String> {
    use std::os::unix::{
        ffi::OsStrExt,
        io::{AsRawFd, FromRawFd},
    };
    let mut directory = File::open("/").map_err(|e| e.to_string())?;
    for component in path.components() {
        match component {
            std::path::Component::RootDir => {}
            std::path::Component::Normal(name) => {
                let name = std::ffi::CString::new(name.as_bytes()).map_err(|e| e.to_string())?;
                let fd = unsafe {
                    libc::openat(
                        directory.as_raw_fd(),
                        name.as_ptr(),
                        libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
                    )
                };
                if fd < 0 {
                    return Err(std::io::Error::last_os_error().to_string());
                }
                directory = unsafe { File::from_raw_fd(fd) };
            }
            _ => {
                return Err("The selected directory must have an absolute normalized path.".into())
            }
        }
    }
    Ok(directory)
}

#[cfg(windows)]
fn windows_identity(file: &File) -> Result<(u32, u32, u32), String> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
    };
    let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
    if unsafe { GetFileInformationByHandle(file.as_raw_handle(), &mut info) } == 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    Ok((
        info.dwVolumeSerialNumber,
        info.nFileIndexHigh,
        info.nFileIndexLow,
    ))
}
#[cfg(windows)]
fn windows_final_path(file: &File) -> Result<PathBuf, String> {
    use std::os::windows::{ffi::OsStringExt, io::AsRawHandle};
    use windows_sys::Win32::Storage::FileSystem::GetFinalPathNameByHandleW;
    let mut buffer = vec![0u16; 32768];
    let length = unsafe {
        GetFinalPathNameByHandleW(
            file.as_raw_handle(),
            buffer.as_mut_ptr(),
            buffer.len() as u32,
            0,
        )
    } as usize;
    if length == 0 || length >= buffer.len() {
        return Err("The delivered file location could not be checked.".into());
    }
    Ok(PathBuf::from(std::ffi::OsString::from_wide(
        &buffer[..length],
    )))
}

pub(crate) fn write_private_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("The credential file has no parent directory.")?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    if let Ok(metadata) = std::fs::symlink_metadata(path) {
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err("The credential file location is not a regular file.".into());
        }
    }
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        temporary
            .as_file()
            .set_permissions(std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    temporary.write_all(bytes).map_err(|e| e.to_string())?;
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    temporary.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn delivered_descriptor_survives_path_replacement() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("fixture");
        std::fs::write(&path, b"first").unwrap();
        let mut file = open_delivered(&path).unwrap();
        std::fs::rename(&path, folder.path().join("original")).unwrap();
        std::fs::write(&path, b"second").unwrap();
        assert_eq!(read_delivered(&mut file).unwrap(), b"first");
        assert_eq!(read_delivered(&mut file).unwrap(), b"first");
    }
    #[cfg(unix)]
    #[test]
    fn folder_grant_keeps_its_directory_and_refuses_links() {
        use std::os::unix::fs::symlink;
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path().canonicalize().unwrap();
        let dir = root.join("watched");
        std::fs::create_dir(&dir).unwrap();
        let other = root.join("other");
        std::fs::create_dir(&other).unwrap();
        std::fs::write(other.join("fixture"), b"other").unwrap();
        std::fs::write(dir.join("fixture"), b"selected").unwrap();
        let grant = DirectoryGrant::open(&dir).unwrap();
        std::fs::rename(&dir, root.join("old")).unwrap();
        symlink(&other, &dir).unwrap();
        let mut file = grant.open_child(&dir.join("fixture")).unwrap();
        assert_eq!(read_delivered(&mut file).unwrap(), b"selected");
        symlink(other.join("fixture"), root.join("old/link")).unwrap();
        assert!(grant.open_child(&dir.join("link")).is_err());
        assert!(grant.open_child(&other.join("fixture")).is_err());
    }
    #[cfg(unix)]
    #[test]
    fn private_advert_is_atomic_owner_only_and_refuses_link_targets() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("advert");
        write_private_atomic(&path, b"fixture").unwrap();
        assert_eq!(
            std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o600
        );
        write_private_atomic(&path, b"updated").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"updated");
        std::fs::remove_file(&path).unwrap();
        let other = root.path().join("other");
        std::fs::write(&other, b"preserve").unwrap();
        symlink(&other, &path).unwrap();
        assert!(write_private_atomic(&path, b"replacement").is_err());
        assert_eq!(std::fs::read(other).unwrap(), b"preserve");
    }
}
