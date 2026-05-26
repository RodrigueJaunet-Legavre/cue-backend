const NOTION_TOKEN = process.env.NOTION_TOKEN
const NOTION_DB = process.env.NOTION_DATABASE_ID

async function notionFetch(endpoint, options = {}) {
  const res = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
  return res.json()
}

async function cacheImage(notionUrl, articleId, index) {
  try {
    const imageRes = await fetch(notionUrl)
    if (!imageRes.ok) return notionUrl

    const buffer = await imageRes.arrayBuffer()
    const ext = notionUrl.split('?')[0].split('.').pop() || 'jpg'
    const path = `blog/${articleId}/image_${index}.${ext}`

    const uploadRes = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/blog-images/${path}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': imageRes.headers.get('content-type') || 'image/jpeg',
          'x-upsert': 'true'
        },
        body: buffer
      }
    )

    if (uploadRes.ok) {
      return `${process.env.SUPABASE_URL}/storage/v1/object/public/blog-images/${path}`
    }
    return notionUrl
  } catch(e) {
    return notionUrl
  }
}

async function parseBlocks(blocks, articleId) {
  let html = ''
  let imgIndex = 0

  for (const block of blocks) {
    const type = block.type
    const content = block[type]

    switch(type) {
      case 'heading_1':
        html += `<h1>${richText(content.rich_text)}</h1>`
        break
      case 'heading_2':
        html += `<h2>${richText(content.rich_text)}</h2>`
        break
      case 'heading_3':
        html += `<h3>${richText(content.rich_text)}</h3>`
        break
      case 'paragraph': {
        const text = richText(content.rich_text)
        if (text) html += `<p>${text}</p>`
        break
      }
      case 'bulleted_list_item':
        html += `<li>${richText(content.rich_text)}</li>`
        break
      case 'numbered_list_item':
        html += `<li>${richText(content.rich_text)}</li>`
        break
      case 'quote':
        html += `<blockquote>${richText(content.rich_text)}</blockquote>`
        break
      case 'code':
        html += `<pre><code>${richText(content.rich_text)}</code></pre>`
        break
      case 'divider':
        html += `<hr>`
        break
      case 'image': {
        const imgUrl = content.type === 'external'
          ? content.external.url
          : content.file.url
        const cachedUrl = await cacheImage(imgUrl, articleId, imgIndex++)
        const caption = content.caption?.length ? richText(content.caption) : ''
        html += `<figure>
          <img src="${cachedUrl}" alt="${caption}" loading="lazy">
          ${caption ? `<figcaption>${caption}</figcaption>` : ''}
        </figure>`
        break
      }
      case 'video': {
        const videoUrl = content.type === 'external' ? content.external.url : ''
        if (videoUrl.includes('youtube') || videoUrl.includes('youtu.be')) {
          const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop()
          html += `<div class="video-embed">
            <iframe src="https://www.youtube.com/embed/${videoId}"
                    frameborder="0" allowfullscreen loading="lazy"></iframe>
          </div>`
        }
        break
      }
      case 'callout':
        html += `<div class="callout">
          <span>${content.icon?.emoji || 'ℹ'}</span>
          <div>${richText(content.rich_text)}</div>
        </div>`
        break
    }
  }
  return html
}

function richText(texts = []) {
  return texts.map(t => {
    let text = t.plain_text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    if (t.annotations?.bold) text = `<strong>${text}</strong>`
    if (t.annotations?.italic) text = `<em>${text}</em>`
    if (t.annotations?.underline) text = `<u>${text}</u>`
    if (t.annotations?.code) text = `<code>${text}</code>`
    if (t.href) text = `<a href="${t.href}" target="_blank">${text}</a>`

    return text
  }).join('')
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' || (req.method === 'POST' && req.body?.action === 'get_articles')) {
    try {
      const data = await notionFetch(`/databases/${NOTION_DB}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            property: 'Status',
            select: { equals: 'Published' }
          },
          sorts: [{ property: 'Date', direction: 'descending' }]
        })
      })

      const articles = await Promise.all(data.results.map(async page => {
        const props = page.properties
        const cover = page.cover?.external?.url || page.cover?.file?.url || null
        const coverId = page.id.replace(/-/g, '')
        const cachedCover = cover ? await cacheImage(cover, coverId, 0) : null

        return {
          id: page.id,
          title: props.Title?.title?.[0]?.plain_text || 'Sans titre',
          slug: props.Slug?.rich_text?.[0]?.plain_text || page.id,
          summary: props.Summary?.rich_text?.[0]?.plain_text || '',
          date: props.Date?.date?.start || null,
          tags: props.Tags?.multi_select?.map(t => t.name) || [],
          cover: cachedCover,
          url: `/blog/${props.Slug?.rich_text?.[0]?.plain_text || page.id}`
        }
      }))

      return res.status(200).json({ articles })
    } catch(err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST' && req.body?.action === 'get_article') {
    const { slug } = req.body
    try {
      const data = await notionFetch(`/databases/${NOTION_DB}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            property: 'Slug',
            rich_text: { equals: slug }
          }
        })
      })

      const page = data.results[0]
      if (!page) return res.status(404).json({ error: 'Article non trouvé' })

      const blocksData = await notionFetch(`/blocks/${page.id}/children?page_size=100`)
      const content = await parseBlocks(blocksData.results, page.id.replace(/-/g, ''))

      const props = page.properties
      const cover = page.cover?.external?.url || page.cover?.file?.url || null
      const cachedCover = cover ? await cacheImage(cover, page.id.replace(/-/g, ''), 99) : null

      return res.status(200).json({
        article: {
          id: page.id,
          title: props.Title?.title?.[0]?.plain_text || '',
          slug: props.Slug?.rich_text?.[0]?.plain_text || page.id,
          summary: props.Summary?.rich_text?.[0]?.plain_text || '',
          date: props.Date?.date?.start || null,
          tags: props.Tags?.multi_select?.map(t => t.name) || [],
          cover: cachedCover,
          content
        }
      })
    } catch(err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(400).json({ error: 'Action invalide' })
}
