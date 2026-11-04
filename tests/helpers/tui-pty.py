"""Exercise the real terminal entry, including JSX, then restore the terminal."""
import fcntl
import os
import pty
import select
import signal
import struct
import subprocess
import sys
import termios
import time

master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))
child = subprocess.Popen(sys.argv[1:], stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
os.close(slave)
output = bytearray()
ready = False
deadline = time.monotonic() + 30
try:
    while time.monotonic() < deadline:
        if select.select([master], [], [], .1)[0]:
            try:
                output.extend(os.read(master, 65536))
            except OSError:
                break
        if not ready and (b'Make a QR code' in output or b'Press / to search' in output):
            ready = True
            os.write(master, b'q')
        if child.poll() is not None:
            break
    if child.poll() is None:
        raise RuntimeError('terminal entry timed out')
    if not ready or child.wait() != 0 or b'\x1b[?1049l' not in output:
        sys.stderr.buffer.write(output[-6000:])
        raise RuntimeError('terminal entry did not mount and restore cleanly')
finally:
    if child.poll() is None:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()
    os.close(master)
