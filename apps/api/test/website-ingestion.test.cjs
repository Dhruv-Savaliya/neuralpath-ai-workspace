const test = require("node:test");
const assert = require("node:assert/strict");
const { isPublicIpv4, extractWebpageText } = require("../dist/ai/website-ingestion.js");

test("public IPv4 validation rejects private, loopback, link-local and reserved ranges", () => {
  for (const address of ["10.0.0.1", "127.0.0.1", "192.168.1.10", "172.20.0.2", "169.254.169.254", "100.64.0.1", "224.0.0.1"]) {
    assert.equal(isPublicIpv4(address), false, address);
  }
  assert.equal(isPublicIpv4("8.8.8.8"), true);
  assert.equal(isPublicIpv4("1.1.1.1"), true);
});

test("webpage extraction removes executable and navigation content and decodes entities", () => {
  const page = extractWebpageText(`
    <html><head><title>AI &amp; Learning</title><script>alert("x")</script></head>
    <body><nav>Navigation must disappear</nav><main><h1>Learning safely</h1>
    <p>Useful learning content with enough readable words for indexing.</p></main>
    <footer>Footer must disappear</footer></body></html>
  `);
  assert.equal(page.title, "AI & Learning");
  assert.match(page.content, /Learning safely/);
  assert.match(page.content, /Useful learning content/);
  assert.doesNotMatch(page.content, /alert|Navigation must disappear|Footer must disappear/);
});
