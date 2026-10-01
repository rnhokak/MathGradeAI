async function main() {
  const js = await (await fetch('https://claudecode.pimath.id.vn/_next/static/chunks/1321-33c08c6206128557.js')).text();
  const idx = js.indexOf('clientId:"9d1c250a-e61b-44d9-88ed-5944d1962f5e"');
  console.log(js.substring(Math.max(0, idx - 400), Math.min(js.length, idx + 800)));
}
main();
