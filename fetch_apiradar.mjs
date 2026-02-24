import fs from "fs";
fetch("https://apiradar.live/explore")
  .then((res) => res.text())
  .then((text) => {
    const apis = text.match(/\/api\/[a-zA-Z0-9_\-\/]+/g);
    console.log(
      "API paths:",
      apis ? Array.from(new Set(apis)) : "No API found",
    );

    // Also look for NEXT_DATA
    const nextDataStr = text.match(
      /<script id="__NEXT_DATA__".*?>(.*?)<\/script>/,
    );
    if (nextDataStr) {
      console.log("Has NEXT_DATA");
    }
  });
