//! Placed movies and sounds (`Movie`, `Sound`) with their poster and
//! link.
//!
//! Evidence: `docs/format/objects.md`, movies and sounds.

use super::*;
use crate::model::{ItemName, Media, MediaKind};

/// `FilePath` of a media link: the URI without `file:`, percent-decoded,
/// with backslashes in a path that starts with a drive letter
/// (objects.md, movies and sounds).
fn native_path(uri: &str) -> String {
    let path = crate::model::percent_decode(uri.strip_prefix("file:").unwrap_or(uri));
    let b = path.as_bytes();
    if b.len() >= 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && b[2] == b'/' {
        path.replace('/', "\\")
    } else {
        path
    }
}

impl Writer<'_> {
    /// A `Movie` or `Sound` element. `outer` is the transform from the
    /// media's frame to the spread.
    pub(super) fn media(&self, x: &mut Xml, m: &Media, outer: &Matrix) {
        let s = &m.settings;
        let flag = |b: bool| b.to_string();
        // Values without a stored field are those of every sample
        // (objects.md, movies and sounds).
        x.start(match m.kind {
            MediaKind::Movie => "Movie",
            MediaKind::Sound => "Sound",
        })
        .attr("Self", uref(Some(m.uid)));
        if let Some(name) = &s.name {
            x.attr("Name", name);
        }
        x.attr("Description", &s.description);
        let file_path = m.link.as_ref().map(|l| native_path(&l.uri));
        match m.kind {
            MediaKind::Movie => {
                let controller = self.dom_version() < (18, 0);
                x.attr("FloatingWindowPosition", "Center")
                    .attr("FloatingWindowSize", "Full")
                    .attr("PlayOnPageTurn", flag(s.play_on_page_turn));
                if controller {
                    x.attr("ShowControls", "false");
                }
                x.attr("FloatingWindow", "false")
                    .attr("EmbedInPDF", flag(s.embed_in_pdf))
                    .attr("PlayMode", if s.looped { "RepeatPlay" } else { "Once" })
                    .attr("CustomPoster", flag(s.custom_poster))
                    .attr_opt("FilePath", file_path);
                if controller {
                    x.attr("ControllerSkin", &s.controller_skin)
                        .attr("ShowController", flag(s.show_controller));
                }
                x.attr("MovieLoop", flag(s.looped));
            }
            MediaKind::Sound => {
                x.attr("PlayOnPageTurn", flag(s.play_on_page_turn))
                    .attr("DoNotPrintPoster", "false")
                    .attr("EmbedInPDF", flag(s.embed_in_pdf))
                    .attr_opt("FilePath", file_path)
                    .attr("StopOnPageTurn", flag(s.stop_on_page_turn))
                    .attr("SoundLoop", flag(s.looped));
            }
        }
        x.attr("ItemTransform", matrix(&m.transform));
        // The name comes from the playback settings, not chunk 0x2C10.
        let props = crate::model::ItemProps {
            name: s.name.clone().map(|name| ItemName {
                builtin: false,
                name,
            }),
            allow_overrides: None,
            ..m.props.clone()
        };
        self.settings(x, &props, None);
        if s.name.is_none() {
            x.remove_attr("Name");
        }
        x.attr("LocalDisplaySetting", "Default");
        if let Some(style) = m.object_style.and_then(|u| self.object_style_ref(u)) {
            x.attr("AppliedObjectStyle", style);
        }
        let [left, top, right, bottom] = m.bounds;
        x.start("Properties");
        if !m.paths.is_empty() {
            Self::path_geometry_element(x, &m.paths);
        }
        x.empty(
            "GraphicBounds",
            &[
                ("Left", num(left)),
                ("Top", num(top)),
                ("Right", num(right)),
                ("Bottom", num(bottom)),
            ],
        );
        Self::label(x, &m.label);
        x.end();
        let applied = m.object_style.and_then(|u| self.style_values(u));
        for (effect, attr, v) in
            transparency::write(self, x, &m.attrs, applied.as_deref(), &uref(Some(m.uid)))
        {
            self.warnings.borrow_mut().push(format!(
                "media {}: {effect} {attr} {v} is outside the IDML range; left out",
                m.uid
            ));
        }
        // The contour of the poster, as for a frame and its graphic.
        let contour = m.poster.as_ref().and_then(|g| self.graphic_contour(g));
        Self::text_wrap_preference(x, m.text_wrap.as_ref(), contour);
        if let Some(g) = &m.poster {
            self.placed_graphic(x, g, &m.transform.then(outer));
        }
        if let Some(link) = &m.link {
            self.link(x, link);
        }
        x.end();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Graphic, GraphicKind, Link, MediaSettings};

    #[test]
    fn native_paths() {
        assert_eq!(
            native_path("file:C:/Users/a%20b/clip%2B1.mp4"),
            "C:\\Users\\a b\\clip+1.mp4"
        );
        assert_eq!(
            native_path("file:/Volumes/Disk/%E5%BD%B1.mov"),
            "/Volumes/Disk/影.mov"
        );
    }

    #[test]
    fn writes_a_movie_with_its_poster() {
        let doc = Document::default();
        let mut w = Writer::for_test(&doc);
        // The controller attributes are on movies below DOM 18.
        w.dom = "10.2".into();
        let poster = Graphic {
            uid: 0x31,
            kind: GraphicKind::Image,
            transform: Matrix::IDENTITY,
            bounds: [0.0, 0.0, 10.0, 10.0],
            link: None,
            contents: None,
            preview: None,
            text_wrap: None,
            contour: Some(crate::model::Contour::DEFAULT),
            clipping: None,
            clipping_paths: Vec::new(),
            props: Default::default(),
            object_style: None,
            attrs: Default::default(),
            image: None,
            profile: None,
            vector_policies: None,
            pdf: None,
            layers: None,
            layer_comp: None,
            import: None,
            alpha_channel: None,
            page_index: None,
        };
        let mut m = Media {
            uid: 0x30,
            kind: MediaKind::Movie,
            transform: Matrix::IDENTITY,
            paths: Vec::new(),
            bounds: [0.0, 0.0, 640.0, 360.0],
            link: Some(Link {
                uid: 0x32,
                uri: "file:D:/v/clip.mp4".into(),
                ..Link::default()
            }),
            settings: MediaSettings {
                name: Some("clip.mp4".into()),
                controller_skin: "SkinOverAll".into(),
                custom_poster: true,
                looped: true,
                ..MediaSettings::default()
            },
            props: Default::default(),
            object_style: None,
            attrs: Default::default(),
            text_wrap: None,
            label: Vec::new(),
            poster: Some(poster),
        };
        let write = |m: &Media| {
            let mut x = Xml::new();
            w.media(&mut x, m, &Matrix::IDENTITY);
            x.finish()
        };
        let out = write(&m);
        for a in [
            "<Movie Self=\"u30\" Name=\"clip.mp4\" Description=\"\"",
            "PlayMode=\"RepeatPlay\" CustomPoster=\"true\" FilePath=\"D:\\v\\clip.mp4\"",
            "ControllerSkin=\"SkinOverAll\" ShowController=\"false\" MovieLoop=\"true\"",
        ] {
            assert!(out.contains(a), "{a}\n{out}");
        }
        let at = |s: &str| out.find(s).unwrap();
        assert!(at("<GraphicBounds") < at("<TextWrapPreference"));
        assert!(at("<ContourOption") < at("<Image Self=\"u31\""));
        assert!(at("<Image") < at("<Link Self=\"u32\""));
        // A sound without a name, poster or link.
        m.kind = MediaKind::Sound;
        m.settings.name = None;
        m.poster = None;
        m.link = None;
        let out = write(&m);
        assert!(
            out.contains("<Sound Self=\"u30\" Description=\"\""),
            "{out}"
        );
        assert!(!out.contains("Name=") && !out.contains("FilePath"));
        assert!(!out.contains("ContourOption") && !out.contains("<Link"));
    }
}
