const test = require("node:test");
const assert = require("node:assert/strict");
const { isPublicIpv4, extractWebpageText, fetchPublicWebpage } = require("../dist/ai/website-ingestion.js");

test("public IPv4 validation rejects private, loopback, link-local and reserved ranges", () => {
  const privateIps = [
    "0.0.0.0",
    "0.1.2.3",
    "10.0.0.1",
    "10.255.255.255",
    "127.0.0.1",
    "127.0.0.2",
    "192.168.1.1",
    "192.168.1.10",
    "192.88.99.1",
    "172.16.0.1",
    "172.20.0.2",
    "172.31.255.255",
    "169.254.169.254", // Cloud metadata
    "169.254.1.1",
    "100.64.0.1", // CGNAT
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1", // Multicast
    "240.0.0.1", // Reserved
    "255.255.255.255",
  ];

  for (const address of privateIps) {
    assert.equal(isPublicIpv4(address), false, `IP ${address} should be rejected as non-public`);
  }

  assert.equal(isPublicIpv4("8.8.8.8"), true);
  assert.equal(isPublicIpv4("1.1.1.1"), true);
  assert.equal(isPublicIpv4("93.184.216.34"), true);
});

test("SSRF protection: rejects non-HTTPS, localhost, custom ports, credentials and IP hostnames", async () => {
  const blockedUrls = [
    // Non-HTTPS protocols
    "http://example.com/test",
    "ftp://example.com/file",
    "file:///etc/passwd",
    "gopher://example.com",
    // Localhost and internal names
    "https://localhost/api",
    "https://test.localhost/doc",
    "https://internal.local/data",
    // Raw IPv4 in hostname (must use public domain names)
    "https://127.0.0.1/secret",
    "https://169.254.169.254/latest/meta-data/",
    "https://10.0.0.1/admin",
    "https://192.168.1.1/",
    // Custom non-standard ports
    "https://example.com:8080/path",
    "https://example.com:22/ssh",
    "https://example.com:8443/api",
    // Embedded credentials
    "https://admin:password@example.com/",
    // Malformed URLs
    "not-a-url",
    "javascript:alert(1)",
  ];

  for (const url of blockedUrls) {
    await assert.rejects(
      async () => {
        await fetchPublicWebpage(url);
      },
      /valid public HTTPS|supported/i,
      `URL ${url} should have been rejected by SSRF validation`,
    );
  }
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
