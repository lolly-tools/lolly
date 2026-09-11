# নির্মাতাদের জন্য Lolly

টেকনিক্যাল ডকুমেন্টেশন - যাঁরা টুল তৈরি করেন, Lolly-কে কোনো পাইপলাইনে ইন্টিগ্রেট করেন, নিজে হোস্ট করেন, বা প্ল্যাটফর্মটি সম্প্রসারিত করেন তাঁদের সবার জন্য।

**এতে আপনার লাভ কী।** একবার একটা টুল বানিয়ে ফেলুন, তারপর একই অনুরোধ আর আপনার কাছে ফিরে আসবে না। যে বারবার-আসা "আমাকে শুধু একটা বানিয়ে দিতে পারবেন কি…" আপনার বিকেলগুলো খেয়ে ফেলে, সেটা একটা টেমপ্লেটে পরিণত হয় যা অন্যরা নিজেরাই ভরে নেয় - সঠিকভাবে, আপনাকে জড়ানো ছাড়াই। আপনার কাজ সাধারণ HTML/CSS/JS: ভার্সন-কন্ট্রোল করা, diff করা যায়, রিভিউ করা যায়, এবং কোনো ভেন্ডর লক-ইন ছাড়াই একটি ওপেন ইঞ্জিনে চলে, তাই তা আপনারই থাকে। প্রোডাকশন রানটা অটোমেট করুন, আর আপনার সময় চলে যাক আকর্ষণীয় সমস্যার দিকে, দশ-হাজারতম এক্সপোর্টে নয়।

Lolly হলো একটি প্ল্যাটফর্ম-নিরপেক্ষ **ইঞ্জিন** যা একাধিক **শেল**-এ (web PWA, Tauri ডেস্কটপ/মোবাইল, CLI, TUI) একই রেন্ডার পাথ চালায়। টুল হলো **ডেটা, বান্ডল করা কোড নয়** - একটি ম্যানিফেস্ট, একটি টেমপ্লেট, আর ঐচ্ছিক hooks - তাই নতুন টুল কোনো অ্যাপ আপডেট ছাড়াই আসে। আর্কিটেকচার বোঝার জন্য [Overview](/info/overview.html) দিয়ে শুরু করুন, তারপর আপনি যা তৈরি করছেন তার সঙ্গে মানানসই ট্র্যাকটি অনুসরণ করুন।

প্ল্যাটফর্মে নতুন? গভীরে যাওয়ার আগে **[Quickstart](/info/quickstart.html)** একটি ব্র্যান্ড আর আপনার প্রথম রেন্ডার তৈরি করে দেয়।

## আর্কিটেকচার বুঝুন



- **[Overview](/info/overview.html)** - কেন Lolly-র অস্তিত্ব, engine/shell/tools-এর পৃথকীকরণ, ক্যাপাবিলিটি ব্রিজ, এবং স্থির হয়ে যাওয়া আর্কিটেকচারাল প্রতিশ্রুতিগুলো।
- **[Design Tokens](/info/design-tokens.html)** - যে DTCG টোকেন মডেলে ব্র্যান্ড প্রকাশ করা হয়, এবং টুল কীভাবে সেগুলো ব্যবহার করে।

## টুল তৈরি করুন

নিচের প্রতিটি কন্ট্রোল `tool.json`-এ ঘোষিত একটি ইনপুট থেকে তৈরি হয়েছে। আপনি ম্যানিফেস্টের লাইনটা লেখেন, হোস্ট উইজেটটা আঁকে, আর একই মডেল CLI আর URL-ও চালায়।

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

এটা পাঁচটা কন্ট্রোলের চেয়ে অনেক দূর পর্যন্ত বাড়ে। কোনো ইনপুটকে একটা `section` দিন আর হোস্ট সেটা গুটিয়ে রাখে, তাই D3 Chart Studio-র মতো পঞ্চাশ-ইনপুটের টুলও একটা ছোট তালিকা হিসেবেই খোলে, বাকিটা নাম দেওয়া গ্রুপের পিছনে সাজানো থাকে।

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Authoring Tools](/info/authoring-tools.html)** - সম্পূর্ণ গাইড: ম্যানিফেস্ট, টেমপ্লেট, স্টাইল, hooks, কম্পোজিশন, এবং পাবলিশিং।
- **[Authoring Assets](/info/authoring-assets.html)** - ক্যাটালগ অ্যাসেট, টিয়ার, লোকেল, প্যালেট, থিমযোগ্য আইকন, এবং ফন্ট।
- **[Host API](/info/host-api.html)** - `HostV1` ক্যাপাবিলিটি ব্রিজ, যার বিপরীতে প্রতিটি টুল লেখা হয় (টুল যে একমাত্র API দেখে)।
- **[URL Mode](/info/url-mode.html)** - প্রতিটি ইনপুট একটি URL প্যারামিটার হিসেবে; সংরক্ষিত প্যারাম, কম্প্যাক্ট এনকোডিং, প্যাকড লিঙ্ক।

## চালান ও ইন্টিগ্রেট করুন

- **[CLI](/info/cli.html)** - হেডলেস রেন্ডারিং; GUI-র মতো একই রেন্ডার পাথ, `--foo=bar` argv দিয়ে চালিত।
- **[TUI](/info/tui.html)** - ইন্টারঅ্যাক্টিভ টার্মিনাল শেল।
- **[MCP Server](/info/mcp.html)** - নেটিভ এন্ডপয়েন্ট যা কোনো AI এজেন্টকে টুল খুঁজে বের করতে ও চালাতে দেয়।
- **[AI Agents](/info/ai-agents.html)** - কোনো মডেল থেকে Lolly চালানো: একটি URL-ই হলো API।
- **[Chrome Extension](/info/extension.html)** - একটি লাইভ URL-কে পুনর্ব্যবহারযোগ্য অ্যাসেট হিসেবে ক্যাপচার করুন।

## শিপ ও পরিচালনা করুন

- **[Build Guide](/info/build-guide.html)** - প্রতিটি টার্গেট বিল্ড করুন: CLI, TUI, ডেস্কটপ, মোবাইল।
- **[Deployment](/info/deployment.html)** - ওয়েব অ্যাপ, অ্যাপগুলো, এবং ব্যাকএন্ড সার্ভিস; কোন অংশটি কোথায় চলে।
- **[Configuration](/info/configuration.html)** - প্রোফাইল, ব্র্যান্ড প্যাক, ক্যাপাবিলিটি গেটিং, ফিচার ফ্ল্যাগ, এবং ক্যাটালগ যাচাই।

## ট্রাস্ট ও ডেটা

অধিকার আর কৃতিত্বও আর সবকিছুর মতোই ইনপুট। Embed & Track Image ক্রিয়েটর, কপিরাইট, লাইসেন্স আর যোগাযোগের ঘর ঘোষণা করে, আর এক্সপোর্ট সেগুলো ফাইলের নিজের মেটাডেটা আর তার C2PA ম্যানিফেস্টে লিখে দেয়।

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Content Credentials Identity](/info/content-credentials-identity.html)** - অন-ডিভাইস C2PA-র জন্য CA-প্রদত্ত সাইনিং; ইঞ্জিন কন্ট্রাক্ট এবং অপারেটর রানবুক।
- **[Data Transfer](/info/data-transfer.html)** - `lolly-backup` বান্ডল: এনভেলপ, ইন্টেগ্রিটি, এবং ক্রস-শেল গ্যারান্টি।
- **[About](/info/about.html)** - প্রকল্পটি, তার লাইসেন্স সীমানা, এবং রিপোজিটরি।
