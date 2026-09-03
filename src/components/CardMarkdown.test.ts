import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { expect, test } from 'vitest'
import { cardMarkdownComponents, cardRemarkPlugins } from './CardMarkdown'

const TABLE_MD = `| prId | comment | n |
| --- | --- | ---: |
| 1234 | Missing null check | 2 |
`

test('renders GFM pipe tables as HTML tables', () => {
  const html = renderToStaticMarkup(
    createElement(ReactMarkdown, {
      remarkPlugins: cardRemarkPlugins,
      components: cardMarkdownComponents,
      children: TABLE_MD,
    }),
  )
  expect(html).toContain('<table')
  expect(html).toContain('<th')
  expect(html).toContain('<td')
  expect(html).toContain('prId')
  expect(html).toContain('Missing null check')
  expect(html).not.toMatch(/\| prId \|/)
})

test('CommonMark without GFM leaves pipe rows as text', () => {
  const html = renderToStaticMarkup(
    createElement(ReactMarkdown, { children: TABLE_MD }),
  )
  expect(html).not.toContain('<table')
})
