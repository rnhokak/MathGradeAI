async function test() {
  const smallPng = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGNYxUAAAn7wEvv7tHrwAAAABJRU5ErkJggg==';

  const variations = [
    {
      name: 'without anthropic-version',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'sk-15c172aa4f3a8c2ef4b7f4c3171806b63166ee99990676e390d3525c' },
      body: {
        model: 'claude-opus-5',
        max_tokens: 100,
        stream: false,
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: smallPng } }, { type: 'text', text: 'Hình gì?' }] }]
      }
    },
    {
      name: 'with thinking_mode: Fast',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'sk-15c172aa4f3a8c2ef4b7f4c3171806b63166ee99990676e390d3525c', 'anthropic-version': '2023-06-01' },
      body: {
        model: 'claude-opus-5',
        max_tokens: 100,
        stream: false,
        thinking_mode: 'Fast',
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: smallPng } }, { type: 'text', text: 'Hình gì?' }] }]
      }
    },
    {
      name: 'with Authorization: Bearer',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-15c172aa4f3a8c2ef4b7f4c3171806b63166ee99990676e390d3525c' },
      body: {
        model: 'claude-opus-5',
        max_tokens: 100,
        stream: false,
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: smallPng } }, { type: 'text', text: 'Hình gì?' }] }]
      }
    }
  ];

  for (const v of variations) {
    try {
      const res = await fetch('https://apikey.pimath.id.vn/v1/messages', {
        method: 'POST',
        headers: v.headers,
        body: JSON.stringify(v.body)
      });
      const data = await res.json();
      console.log(`[${v.name}] status=${res.status} content=`, data?.choices?.[0]?.message?.content?.slice(0, 100));
    } catch (e) {
      console.log(`[${v.name}] error:`, e.message);
    }
  }
}

test();
