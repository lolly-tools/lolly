# Lolly ও Penpot

_সর্বশেষ যাচাই: 28 সেপ্টেম্বর 2026।_

আপনার দল যদি Penpot-এ ডিজাইন করে, Lolly Penpot-এর পাশাপাশি কাজ করে: দুটিই ওপেন সোর্স এবং দুটিই একই ডিজাইন টোকেন পড়ে। এই পৃষ্ঠা বলে প্রতিটি কোন কাজের জন্য।

## Penpot যা আরও ভালো করে

[Penpot](https://penpot.app/) ইন্টারফেস ডিজাইন, কম্পোনেন্ট, নমনীয় লেআউট, ইন্টার‍্যাকটিভ প্রোটোটাইপ ও ডেভেলপার ইন্সপেকশন দেয়, রিয়েল-টাইম সম্পাদনা ও লাইভ কার্সরসহ। এটি হোস্ট করা ও self-hosted ডিপ্লয়মেন্ট দেয়, [Docker and Kubernetes installation options](https://help.penpot.app/technical-guide/getting-started/)-সহ। অ্যাপ্লিকেশন ডিজাইনের জন্য Penpot-ই সেই টুল।

## যেখানে দুটি মিলে যায়

[Penpot's design tokens](https://help.penpot.app/user-guide/design-systems/design-tokens/) DTCG ফরম্যাট ব্যবহার করে, যা Lolly-ও পড়ে, তাই রং, টাইপ ও অন্য টোকেন মান দুটির মধ্যে চলাচল করে। Lolly-র [Import a design](/info/design-import.html) একটি `.penpot` এক্সপোর্টকে সম্পাদনাযোগ্য লেআউট হিসেবে খোলে, আর Lolly-র **Send to Penpot** একটি ডিজাইনকে `.penpot` আর্কাইভ হিসেবে ফেরত পাঠায়। Lolly [Lolly Export plugin for Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export)-ও রক্ষণাবেক্ষণ করে, যা Lolly-র ইঞ্জিন ব্যবহার করে ডিভাইসেই ঐচ্ছিক Content Credentials যোগ করে।

## Lolly কীভাবে একই ধরনের কাজ করে

Lolly-র Design ক্যানভাস সম্পাদনাযোগ্য অ্যাসেট বানায় এবং একটি লেআউটকে [tool with rules](/info/create-a-tool.html) করে তুলতে পারে। একই টুল ব্রাউজার, ডেস্কটপ অ্যাপ বা CLI-তে রেন্ডার করে এবং ডেটা থেকে ভ্যারিয়েন্ট বানায়। আলাদাভাবে ব্যবহৃত Lolly ডিভাইসেই রেন্ডার ও স্বাক্ষর করে, অ্যাকাউন্ট বা সার্ভার ছাড়া। একটি [private collab](/info/collaborate.html) দুটি ডিভাইসকে সরাসরি জুড়ে দেয়।

## প্রতিষ্ঠানের সঙ্গে

Lolly Work যোগ করে সিঙ্গেল সাইন-অন, SCIM প্রভিশনিং, শেয়ার করা ক্যাটালগ ও প্রকল্প, ভূমিকা, অনুমোদন, অডিট রেকর্ড, work collab ও সার্ভার রেন্ডারিং। দুটি রিপোজিটরিই MPL-2.0 এবং একটি প্রতিষ্ঠান দুটিই চালাতে পারে। [What runs where](/info/compare.html#what-runs-where) দুটি অংশ পাশাপাশি রাখে।

আপনি দুটিই ব্যবহার করতে পারেন: ইন্টারফেস ডিজাইন ও প্রোটোটাইপিংয়ের জন্য Penpot, পুনরাবৃত্তিযোগ্য ফাইলের জন্য Lolly, শেয়ার করা টোকেন ও ইমপোর্ট করা ডিজাইন দিয়ে জোড়া।

Penpot তার মালিকের ট্রেডমার্ক। এই পৃষ্ঠা বর্ণনা করে দুটি পণ্য কোথায় মেলে এবং Penpot-এর সঙ্গে সম্পর্কিত নয়।
