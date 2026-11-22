// SPDX-License-Identifier: MPL-2.0
//! `lolly-render <input.json|-> [<out.png>|-]`: a test binary for the CPU path.
//!
//! Reads one input document and writes the page as a plain PNG. `--check` admits
//! only and writes nothing. A refused page prints its reasons as JSON on stdout,
//! one object with a `refusals` array of `{code, id, detail}`, and exits 3. Usage and
//! file errors exit 2. A drawn page exits 0 and, with `--json`, prints its size.

#![forbid(unsafe_code)]

use std::io::{Read, Write};
use std::process::ExitCode;

fn json_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn refused(refusals: &[lolly_render::Refusal]) -> ExitCode {
    let items: Vec<String> = refusals
        .iter()
        .map(|r| format!("{{\"code\":{},\"id\":{},\"detail\":{}}}", json_string(r.code), json_string(&r.id), json_string(&r.detail)))
        .collect();
    println!("{{\"drawn\":false,\"refusals\":[{}]}}", items.join(","));
    ExitCode::from(3)
}

fn usage(message: &str) -> ExitCode {
    eprintln!("lolly-render: {message}\nusage: lolly-render [--check] [--json] <input.json|-> [<out.png>|-]");
    ExitCode::from(2)
}

fn main() -> ExitCode {
    let mut check = false;
    let mut json = false;
    let mut paths: Vec<String> = Vec::new();
    for arg in std::env::args().skip(1) {
        match arg.as_str() {
            "--check" => check = true,
            "--json" => json = true,
            "--version" => {
                println!("{}", lolly_render::RENDERER);
                return ExitCode::SUCCESS;
            }
            "-" => paths.push(arg),
            a if a.starts_with("--") => return usage(&format!("unknown option {a}")),
            _ => paths.push(arg),
        }
    }
    if paths.is_empty() || paths.len() > 2 || (!check && paths.len() != 2) {
        return usage("give an input and, unless --check, an output");
    }
    let limit = lolly_render::admit::MAX_INPUT_BYTES as u64 + 1;
    let mut bytes = Vec::new();
    let read = if paths[0] == "-" {
        std::io::stdin().take(limit).read_to_end(&mut bytes)
    } else {
        std::fs::File::open(&paths[0]).and_then(|f| f.take(limit).read_to_end(&mut bytes))
    };
    if let Err(e) = read {
        return usage(&format!("cannot read {}: {e}", paths[0]));
    }
    let plan = match lolly_render::admit_json(&bytes) {
        Ok(plan) => plan,
        Err(refusals) => return refused(&refusals),
    };
    if check {
        println!("{{\"drawn\":false,\"admitted\":true,\"width\":{},\"height\":{}}}", plan.pixel_width, plan.pixel_height);
        return ExitCode::SUCCESS;
    }
    let drawn = match lolly_render::render_plan(&plan) {
        Ok(d) => d,
        Err(refusals) => return refused(&refusals),
    };
    let png = lolly_render::encode_png(&drawn.rgba, drawn.width, drawn.height, plan.dpi);
    let written = if paths[1] == "-" { std::io::stdout().write_all(&png) } else { std::fs::write(&paths[1], &png) };
    if let Err(e) = written {
        return usage(&format!("cannot write {}: {e}", paths[1]));
    }
    if json {
        eprintln!("{{\"drawn\":true,\"width\":{},\"height\":{},\"bytes\":{}}}", drawn.width, drawn.height, png.len());
    }
    ExitCode::SUCCESS
}
