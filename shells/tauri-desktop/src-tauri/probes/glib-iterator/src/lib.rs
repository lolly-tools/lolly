// SPDX-License-Identifier: MPL-2.0
#[cfg(test)]
mod tests {
    use glib::variant::ToVariant;

    #[test]
    fn string_array_iteration_reads_forward_reverse_and_skipped_items() {
        let value = ["first", "middle", "last"].to_variant();
        assert_eq!(value.array_iter_str().unwrap().collect::<Vec<_>>(), ["first", "middle", "last"]);
        assert_eq!(value.array_iter_str().unwrap().rev().collect::<Vec<_>>(), ["last", "middle", "first"]);
        assert_eq!(value.array_iter_str().unwrap().nth(1), Some("middle"));
        assert_eq!(value.array_iter_str().unwrap().nth_back(1), Some("middle"));
        assert_eq!(value.array_iter_str().unwrap().last(), Some("last"));
        assert_eq!([""].to_variant().array_iter_str().unwrap().next(), Some(""));
        assert_eq!(Vec::<&str>::new().to_variant().array_iter_str().unwrap().next(), None);
    }
}
