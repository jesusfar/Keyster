async function checkPastebinAlternative() {
  console.log('--- Testing Pastebin Alternative (Proxy) ---')
  // We can try to just fetch the main page and look for recent pastes, but it's heavily cloudflare protected.
  // Instead, let's test a GitHub search for HuggingFace tokens or specifically targeting .env files again
  try {
    const res = await fetch(`https://api.github.com/search/code?q=hf_`)
    console.log('Status GH:', res.status)
  } catch (err) {
    console.error('Alt Error:', err.message)
  }
}

checkPastebinAlternative()
