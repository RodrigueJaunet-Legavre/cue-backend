module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const NOTION_TOKEN = process.env.NOTION_TOKEN
  const NOTION_DB = process.env.NOTION_DATABASE_ID
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  const body = req.method === 'POST' ? req.body : {}
  const action = body.action || 'get_articles'

  async function notionFetch(endpoint, options = {}) {
    const r = await fetch(`https://api.notion.com/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    })
    return r.json()
  }

  async function cacheImage(url, id, idx) {
    try {
      if (!url) return null
      const imgRes = await fetch(url)
      if (!imgRes.ok) return url
      const buf = await imgRes.arrayBuffer()
      const ext = url.split('?')[0].split('.').pop().split('/').pop() || 'jpg'
      const path = `blog/${id}/img_${idx}.${ext}`
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/blog-images/${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
          'x-upsert': 'true'
        },
        body: buf
      })
      if (up.ok) return `${SUPABASE_URL}/storage/v1/object/public/blog-images/${path}`
      return url
    } catch(e) { return url }
  }

  function richText(texts = []) {
    return texts.map(t => {
      let text = (t.plain_text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      if (t.annotations?.bold) text = `<strong>${text}</strong>`
      if (t.annotations?.italic) text = `<em>${text}</em>`
      if (t.annotations?.underline) text = `<u>${text}</u>`
      if (t.annotations?.code) text = `<code>${text}</code>`
      if (t.href) text = `<a href="${t.href}" target="_blank" rel="noopener">${text}</a>`
      return text
    }).join('')
  }

  async function parseBlocks(blocks, articleId) {
    let html = ''
    let imgIdx = 0
    for (const block of blocks) {
      const type = block.type
      const c = block[type]
      if (!c) continue
      switch(type) {
        case 'heading_1': html += `<h1>${richText(c.rich_text)}</h1>`; break
        case 'heading_2': html += `<h2>${richText(c.rich_text)}</h2>`; break
        case 'heading_3': html += `<h3>${richText(c.rich_text)}</h3>`; break
        case 'paragraph': { const t = richText(c.rich_text); if(t) html += `<p>${t}</p>`; break }
        case 'bulleted_list_item': html += `<li>${richText(c.rich_text)}</li>`; break
        case 'numbered_list_item': html += `<li>${richText(c.rich_text)}</li>`; break
        case 'quote': html += `<blockquote>${richText(c.rich_text)}</blockquote>`; break
        case 'code': html += `<pre><code>${richText(c.rich_text)}</code></pre>`; break
        case 'divider': html += `<hr>`; break
        case 'callout': html += `<div class="callout"><span>${c.icon?.emoji||'i'}</span><div>${richText(c.rich_text)}</div></div>`; break
        case 'image': {
          const imgUrl = c.type === 'external' ? c.external?.url : c.file?.url
          if (imgUrl) {
            const cached = await cacheImage(imgUrl, articleId, imgIdx++)
            const cap = c.caption?.length ? richText(c.caption) : ''
            html += `<figure><img src="${cached}" alt="${cap}" loading="lazy">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`
          }
          break
        }
        case 'video': {
          const vUrl = c.type === 'external' ? c.external?.url : ''
          if (vUrl && (vUrl.includes('youtube') || vUrl.includes('youtu.be'))) {
            const vid = vUrl.split('v=')[1]?.split('&')[0] || vUrl.split('/').pop()
            html += `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`
          }
          break
        }
      }
    }
    return html
  }

  // ── GET ARTICLES ──
  if (action === 'get_articles') {
    try {
      const data = await notionFetch(`/databases/${NOTION_DB}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: 'Status', select: { equals: 'Published' } },
          sorts: [{ property: 'Date', direction: 'descending' }]
        })
      })

      const articles = await Promise.all((data.results || []).map(async page => {
        const props = page.properties
        const rawCover = page.cover?.external?.url || page.cover?.file?.url || null
        const coverId = page.id.replace(/-/g,'')
        const cover = rawCover ? await cacheImage(rawCover, coverId, 0) : null
        return {
          id: page.id,
          title: props.Title?.title?.[0]?.plain_text || 'Sans titre',
          slug: props.Slug?.rich_text?.[0]?.plain_text || page.id,
          summary: props.Summary?.rich_text?.[0]?.plain_text || '',
          date: props.Date?.date?.start || null,
          tags: props.Tags?.multi_select?.map(t => t.name) || [],
          cover
        }
      }))

      return res.status(200).json({ articles })
    } catch(err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // ── GET ARTICLE ──
  if (action === 'get_article') {
    const { slug } = body
    try {
      const data = await notionFetch(`/databases/${NOTION_DB}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: 'Slug', rich_text: { equals: slug } }
        })
      })
      const page = data.results?.[0]
      if (!page) return res.status(404).json({ error: 'Article non trouvé' })

      const blocksData = await notionFetch(`/blocks/${page.id}/children?page_size=100`)
      const aid = page.id.replace(/-/g,'')
      const content = await parseBlocks(blocksData.results || [], aid)

      const props = page.properties
      const rawCover = page.cover?.external?.url || page.cover?.file?.url || null
      const cover = rawCover ? await cacheImage(rawCover, aid, 99) : null

      return res.status(200).json({
        article: {
          id: page.id,
          title: props.Title?.title?.[0]?.plain_text || '',
          slug: props.Slug?.rich_text?.[0]?.plain_text || page.id,
          summary: props.Summary?.rich_text?.[0]?.plain_text || '',
          date: props.Date?.date?.start || null,
          tags: props.Tags?.multi_select?.map(t => t.name) || [],
          cover,
          content
        }
      })
    } catch(err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(400).json({ error: 'Action invalide' })
}
