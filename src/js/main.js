import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix Leaflet's default marker icon paths, which break under Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// ---------------------------------------------------------------------------
// getChild()
// Helper: finds a direct child element by tag name.
// Uses tagName comparison instead of getElementsByTagName, which has
// proven unreliable for XML documents parsed with DOMParser in some browsers.
// ---------------------------------------------------------------------------
function getChild(node, tag) {
  if (!node) {
    console.log('getChild called with null node, tag:', tag)
    return null
  }
  const result = Array.from(node.children).find(el => el.tagName === tag) ?? null
  console.log(`getChild(${tag}):`, result)
  return result
}

// ---------------------------------------------------------------------------
// parseDate()
// Reads a <date> node and returns a structured object.
// year and era are always present; month and day are optional.
// ---------------------------------------------------------------------------
function parseDate(dateNode) {
  const year  = parseInt(getChild(dateNode, 'year')?.textContent.trim())
  const month = getChild(dateNode, 'month')?.textContent.trim() ?? 0
  const day   = getChild(dateNode, 'day')?.textContent.trim()   ?? 0
  const era   = getChild(dateNode, 'era')?.textContent.trim()

  return { year, month, day, era }
}

// ---------------------------------------------------------------------------
// toAstronomicalYear()
// Converts a parsed date to a single number on a continuous timeline.
// BC 55 = -55, BC 1 = -1, year 0 = 0, AD 1 = 1, AD 1789 = 1789
// ---------------------------------------------------------------------------
function toAstronomicalYear(parsedDate) {
  if (parsedDate.era === 'BC') {
    return -(parsedDate.year)
  } else {
    return parsedDate.year
  }
}

// ---------------------------------------------------------------------------
// formatDate()
// Turns a parsed date object into a human-readable string.
// ---------------------------------------------------------------------------
function formatDate({ year, month, day, era }) {
  const monthNames = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ]
  const parts = []
  if (day)   parts.push(parseInt(day))
  if (month) parts.push(monthNames[parseInt(month) - 1])
  parts.push(year)
  if (era === 'BC') parts.push('BC')
  return parts.join(' ')
}

function formatDateEnd({ year, month, day, era }) {
  const monthNames = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ]
  const parts = []
  if (day)   parts.push(parseInt(day))
  if (month) parts.push(monthNames[parseInt(month) - 1])
  parts.push(year)
  if (era === 'BC') parts.push('BC')
  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// parseEvents()
// Fetches public/events.xml and returns a plain JS array of event objects.
// Uses import.meta.env.BASE_URL so paths work in both dev and gh-pages.
// Reads both type="start" and type="end" date elements.
// ---------------------------------------------------------------------------
async function parseEvents() {
  const response = await fetch(`${import.meta.env.BASE_URL}events.xml`)
  const text = await response.text()
  const xml = new DOMParser().parseFromString(text, 'application/xml')

  const trackNodes = Array.from(xml.documentElement.children)

  console.log('first node type:', trackNodes[0].nodeType, 'tag:', trackNodes[0].tagName)

  return trackNodes.flatMap(trackNode => {
    const track = Number(trackNode.getAttribute('type') ?? 1)
    const name = trackNode.getAttribute('name') ?? ""
    const eventNodes = Array.from(trackNode.children)

    return eventNodes.map(node => {
      const startDateNode = Array.from(node.children).find(el => el.tagName === 'date' && el.getAttribute('type') === 'start')
      const endDateNode   = Array.from(node.children).find(el => el.tagName === 'date' && el.getAttribute('type') === 'end')

      const startDate = parseDate(startDateNode)
      const endDate   = endDateNode && endDateNode.children.length > 0 ? parseDate(endDateNode) : null

      return {
        track,
        name,
        title:               getChild(node, 'title')?.textContent.trim(),
        date:                startDate,
        endDate:             endDate,
        astronomicalYear:    toAstronomicalYear(startDate),
        astronomicalYearEnd: endDate ? toAstronomicalYear(endDate) : null,
        displayDate:         formatDate(startDate),
        displayDateEnd:      endDate ? formatDate(endDate) : "",
        description:         getChild(node, 'description')?.textContent.trim(),
        lat:                 parseFloat(getChild(node, 'lat')?.textContent),
        lon:                 parseFloat(getChild(node, 'lon')?.textContent),
        media:               getChild(node, 'media')?.textContent.trim() ?? null,
      }
    })
  })
}

// ---------------------------------------------------------------------------
// buildMap()
// Initialises a Leaflet map and adds one marker per event.
// Clicking a marker triggers full event selection.
// ---------------------------------------------------------------------------
function buildMap(events, onSelect) {
  const svgNS = 'http://www.w3.org/2000/svg'

  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('width', 200)
  svg.setAttribute('height', 300)
  svg.setAttribute('viewBox', `0 0 200 400`)

  const manila = document.createElementNS(svgNS, 'rect')
  manila.setAttribute('x', 40)
  manila.setAttribute('y', 20)
  manila.setAttribute('width', 150)
  manila.setAttribute('height', 50)
  manila.setAttribute('rx', 6)
  manila.setAttribute('fill', '#ffd484')
  svg.appendChild(manila)

  const map = L.map('map').setView([48.8566, 2.3522], 4)

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map)

  var pinIcon = L.icon({
    iconUrl: './images/pin.png',
    iconSize:    [50, 60],
    iconAnchor:  [25, 60],
    popupAnchor: [0, -60]
  })

  events.forEach((event, index) => {
    const marker = L.marker([event.lat, event.lon], { icon: pinIcon })
      .addTo(map)
      .bindPopup(`<strong>${event.title}</strong><br>${event.displayDate}`)

    marker.on('click', () => onSelect(index))
  })

  return map
}

// ---------------------------------------------------------------------------
// buildCardSVG()
// Builds the decorative background SVG for the card panel —
// horizontal lines, vertical red line. No text, no buttons.
// Returns the SVG element so it can be used as a CSS background.
// ---------------------------------------------------------------------------
function buildCardSVG(width, height) {
  const svgNS = "http://www.w3.org/2000/svg"

  const screenWidth = window.innerWidth
  const svgHeight = 159
  const svgWidth = screenWidth

  const svg = document.createElementNS(svgNS, "svg")
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
  svg.setAttribute('width', svgWidth)
  svg.setAttribute('height', svgHeight)
  svg.setAttribute('xmlns', svgNS)

  const lineYs = [40, 65, 90, 115, 140, 166]
  lineYs.forEach(y => {
    const line = document.createElementNS(svgNS, "line")
    line.setAttribute('x1', 0); line.setAttribute('y1', y)
    line.setAttribute('x2', width); line.setAttribute('y2', y)
    line.setAttribute('stroke', '#173aff')
    line.setAttribute('stroke-width', y === 166 ? 3 : 3)
    svg.appendChild(line)
  })

  const vline = document.createElementNS(svgNS, "line")
  vline.setAttribute('x1', 30); vline.setAttribute('y1', 0)
  vline.setAttribute('x2', 30); vline.setAttribute('y2', height)
  vline.setAttribute('stroke', '#ff0000')
  vline.setAttribute('stroke-width', 6)
  svg.appendChild(vline)

  return svg
}

// ---------------------------------------------------------------------------
// buildCard()
// Renders the card panel for the currently selected event.
// The SVG (lines + red line) is the background layer.
// All text and buttons are real HTML elements on top — they wrap naturally
// and reflow on mobile without any SVG text limitations.
// On narrow screens the arrow buttons drop below the text automatically.
// ---------------------------------------------------------------------------
function buildCard(event, index, events, onSelect) {
  const panel = document.getElementById('card-panel')
  panel.innerHTML = ''

  // --- Background SVG layer ---
  const svgBg = buildCardSVG(panel.offsetWidth || window.innerWidth, 175)
  svgBg.classList.add('card-bg-svg')
  panel.appendChild(svgBg)

  // --- HTML content layer sits on top of the SVG ---
  const content = document.createElement('div')
  content.className = 'card-content'

  // Left column: red line spacer + text
  const textCol = document.createElement('div')
  textCol.className = 'card-text-col'

  const dateEl = document.createElement('p')
  dateEl.className = 'card-date'
  dateEl.textContent = event.displayDateEnd
    ? `${event.displayDate} — ${event.displayDateEnd}`
    : event.displayDate
  textCol.appendChild(dateEl)

  const titleEl = document.createElement('p')
  titleEl.className = 'card-title'
  titleEl.textContent = event.title
  textCol.appendChild(titleEl)

  const descEl = document.createElement('p')
  descEl.className = 'card-desc'
  descEl.textContent = event.description
  textCol.appendChild(descEl)

  content.appendChild(textCol)

  // Arrow buttons column — flows below text on mobile via flex-wrap
  const btnCol = document.createElement('div')
  btnCol.className = 'card-btn-col'

  if (index > 0) {
    const prevBtn = document.createElement('button')
    prevBtn.className = 'card-btn'
    const prevImg = document.createElement('img')
    prevImg.src = './images/arrowB.png'
    prevImg.alt = 'Previous'
    prevBtn.appendChild(prevImg)
    prevBtn.addEventListener('click', () => onSelect(index - 1))
    btnCol.appendChild(prevBtn)
  }

  if (index < events.length - 1) {
    const nextBtn = document.createElement('button')
    nextBtn.className = 'card-btn'
    const nextImg = document.createElement('img')
    nextImg.src = './images/arrow.png'
    nextImg.alt = 'Next'
    nextBtn.appendChild(nextImg)
    nextBtn.addEventListener('click', () => onSelect(index + 1))
    btnCol.appendChild(nextBtn)
  }

  content.appendChild(btnCol)
  panel.appendChild(content)
}

// ---------------------------------------------------------------------------
// buildFixedPanel()
// Draws the fixed left panel — track labels, horizontal lines, vertical
// divider — into #timeline-fixed. This element does NOT scroll, so these
// elements stay in place while the ruler scrolls behind them.
// y positions must match the span rectangles in buildTimelineSVG().
// ---------------------------------------------------------------------------
function buildFixedPanel(events, svgHeight) {
  const svgNS = 'http://www.w3.org/2000/svg'
  const panelWidth = 200
  const fixed = document.getElementById('timeline-fixed')
  fixed.setAttribute('viewBox', `0 0 ${panelWidth} ${svgHeight}`)
  fixed.setAttribute('width', panelWidth)
  fixed.setAttribute('height', svgHeight)

  const lineYs = [-10, 15, 40, 65, 90, 115, 140, 165, 190, 215, 240, 265]
  lineYs.forEach(y => {
    const line = document.createElementNS(svgNS, 'line')
    line.setAttribute('x1', 0); line.setAttribute('y1', y)
    line.setAttribute('x2', panelWidth); line.setAttribute('y2', y)
    line.setAttribute('stroke', '#173aff'); line.setAttribute('stroke-width', 3)
    fixed.appendChild(line)
  })

  const vline = document.createElementNS(svgNS, 'line')
  vline.setAttribute('x1', 30); vline.setAttribute('y1', -10)
  vline.setAttribute('x2', 30); vline.setAttribute('y2', 1000)
  vline.setAttribute('stroke', '#ff0000'); vline.setAttribute('stroke-width', 6)
  fixed.appendChild(vline)

  const trackY = { 1: 62, 2: 136, 3: 211 }
  const seen = new Set()
  events.forEach(event => {
    if (seen.has(event.track)) return
    seen.add(event.track)

    const highlightL = document.createElementNS(svgNS, 'line')
    highlightL.setAttribute('x1', 35); highlightL.setAttribute('y1', trackY[event.track] - 10)
    highlightL.setAttribute('x2', panelWidth); highlightL.setAttribute('y2', trackY[event.track] - 10)
    highlightL.setAttribute('stroke', '#ff910091'); highlightL.setAttribute('stroke-width', 25)
    fixed.appendChild(highlightL)

    const label = document.createElementNS(svgNS, 'text')
    label.setAttribute('x', 40)
    label.setAttribute('y', trackY[event.track])
    label.setAttribute('fill', '#ff0000'); label.setAttribute('font-size', 30)
    label.setAttribute('style', 'font-weight: 700; font-family: "BrownCookies";')
    label.textContent = event.name
    fixed.appendChild(label)
  })
}

// ---------------------------------------------------------------------------
// buildTimelineSVG()
// Generates the proportional SVG timeline ruler from event data.
// Replicates the XSLT logic from timeline.xsl:
//   - x-spacer of 10 units per year
//   - tick marks every 1 / 5 / 10 / 50 / 100 years
//   - span rectangles from start to end date for each event
//   - group translated so negative (BC) coordinates are visible
// The fixed left panel (labels, lines) lives in buildFixedPanel() and
// does not scroll. Only the ruler content lives here.
// ---------------------------------------------------------------------------
function buildTimelineSVG(events, onSelect) {
  const xSpacer     = 10
  const svgHeight   = 288
  const rulerY      = 10
  const rulerHeight = 220

  const years = events.map(e => e.astronomicalYear)
  const earliestDate = Math.min(...years)
  const latestDate   = Math.max(...years)
  const padding    = 100
  const rulerWidth = (latestDate - earliestDate) * xSpacer + padding * 2
  const translateX = Math.abs(earliestDate) * xSpacer + 140
  const svgWidth   = rulerWidth + translateX

  const svgNS = 'http://www.w3.org/2000/svg'

  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('width', svgWidth)
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
  svg.style.display = 'block'

  const g = document.createElementNS(svgNS, 'g')
  const translateY = 10
  g.setAttribute('transform', `translate(${translateX}, ${translateY})`)

  const lineYs = [-10, 15, 40, 65, 90, 115, 140, 165, 190, 215, 240, 265]
  lineYs.forEach(y => {
    const line = document.createElementNS(svgNS, 'line')
    line.setAttribute('x1', -700); line.setAttribute('y1', y)
    line.setAttribute('x2', svgWidth); line.setAttribute('y2', y)
    line.setAttribute('stroke', '#173aff'); line.setAttribute('stroke-width', 3)
    g.appendChild(line)
  })

  // Background rectangle
  const rect = document.createElementNS(svgNS, 'rect')
  rect.setAttribute('width', rulerWidth)
  rect.setAttribute('height', rulerHeight)
  rect.setAttribute('x', earliestDate * xSpacer - padding)
  rect.setAttribute('y', rulerY)
  rect.setAttribute('rx', 20); rect.setAttribute('ry', 20)
  rect.setAttribute('fill', '#6cebba9d')
  rect.setAttribute('stroke', '#4f9987'); rect.setAttribute('stroke-width', '3')
  rect.style.filter = 'drop-shadow(3px 3px 5px rgba(2, 29, 102, 0.45))'
  g.appendChild(rect)

  // Tick marks — every 1 / 5 / 10 / 50 / 100 years
  for (let year = Math.ceil(earliestDate); year <= latestDate; year += 1) {
    const x = year * xSpacer
    const isCentury     = year % 100 === 0
    const isHalfCentury = year % 50  === 0
    const isDecade      = year % 10  === 0
    const isHalfDecade  = year % 5   === 0

    if (isCentury) {
      const line = document.createElementNS(svgNS, 'line')
      line.setAttribute('x1', x); line.setAttribute('y1', rulerY)
      line.setAttribute('x2', x); line.setAttribute('y2', rulerY + 190)
      line.setAttribute('stroke', 'white'); line.setAttribute('stroke-width', 10)
      line.style.filter = 'drop-shadow(3px 3px 5px rgba(2, 102, 47, 0.25))'
      g.appendChild(line)
      const text = document.createElementNS(svgNS, 'text')
      text.setAttribute('x', x); text.setAttribute('y', rulerY + 210)
      text.setAttribute('fill', '#ffffff'); text.setAttribute('font-size', 18)
      text.setAttribute('style', 'font-weight: 900;'); text.setAttribute('text-anchor', 'middle')
      text.textContent = year
      g.appendChild(text)
    } else if (isHalfCentury) {
      const line = document.createElementNS(svgNS, 'line')
      line.setAttribute('x1', x); line.setAttribute('y1', rulerY)
      line.setAttribute('x2', x); line.setAttribute('y2', rulerY + 140)
      line.setAttribute('stroke', 'white'); line.setAttribute('stroke-width', 5)
      line.style.filter = 'drop-shadow(3px 3px 5px rgba(2, 102, 47, 0.25))'
      g.appendChild(line)
      const text = document.createElementNS(svgNS, 'text')
      text.setAttribute('x', x); text.setAttribute('y', rulerY + 157)
      text.setAttribute('fill', '#ffffff'); text.setAttribute('font-size', 15)
      text.setAttribute('style', 'font-weight: 700;'); text.setAttribute('text-anchor', 'middle')
      text.textContent = year
      g.appendChild(text)
    } else if (isDecade) {
      const line = document.createElementNS(svgNS, 'line')
      line.setAttribute('x1', x); line.setAttribute('y1', rulerY)
      line.setAttribute('x2', x); line.setAttribute('y2', rulerY + 90)
      line.setAttribute('stroke', 'white'); line.setAttribute('stroke-width', 3)
      line.style.filter = 'drop-shadow(3px 3px 5px rgba(2, 102, 47, 0.25))'
      g.appendChild(line)
      const text = document.createElementNS(svgNS, 'text')
      text.setAttribute('x', x); text.setAttribute('y', rulerY + 106)
      text.setAttribute('fill', '#ffffff'); text.setAttribute('font-size', 13)
      text.setAttribute('style', 'font-weight: 500;'); text.setAttribute('text-anchor', 'middle')
      text.textContent = year
      g.appendChild(text)
    } else if (isHalfDecade) {
      const line = document.createElementNS(svgNS, 'line')
      line.setAttribute('x1', x); line.setAttribute('y1', rulerY)
      line.setAttribute('x2', x); line.setAttribute('y2', rulerY + 50)
      line.setAttribute('stroke', 'white'); line.setAttribute('stroke-width', 2)
      line.style.filter = 'drop-shadow(3px 3px 5px rgba(2, 102, 47, 0.25))'
      g.appendChild(line)
    } else {
      const line = document.createElementNS(svgNS, 'line')
      line.setAttribute('x1', x); line.setAttribute('y1', rulerY)
      line.setAttribute('x2', x); line.setAttribute('y2', rulerY + 25)
      line.setAttribute('stroke', 'white'); line.setAttribute('stroke-width', 1)
      line.style.filter = 'drop-shadow(3px 3px 5px rgba(2, 102, 47, 0.25))'
      g.appendChild(line)
    }
  }

  const hole = document.createElementNS(svgNS, 'circle')
  hole.setAttribute('cx', -600); hole.setAttribute('cy', 120); hole.setAttribute('r', 20)
  hole.setAttribute('fill', '#ecece8')
  hole.setAttribute('stroke', '#5a8f82'); hole.setAttribute('stroke-width', '3')
  hole.style.filter = 'drop-shadow(3px 3px 5px #c3eee9af)'
  g.appendChild(hole)

  // Event span rectangles — drawn from start to end date
  const trackY = { 1: 39, 2: 114, 3: 189 }
  events.forEach((event, index) => {
    const startX = event.astronomicalYear * xSpacer
    const endX   = event.astronomicalYearEnd !== null
      ? event.astronomicalYearEnd * xSpacer
      : startX + 20
    const spanWidth = Math.max(endX - startX, 20)

    const note = document.createElementNS(svgNS, 'rect')
    note.setAttribute('width', spanWidth)
    note.setAttribute('height', 27)
    note.setAttribute('x', startX)
    note.setAttribute('y', trackY[event.track])
    note.setAttribute('fill', '#e61edca1')
    note.setAttribute('class', 'event-span')
    note.setAttribute('data-index', index)
    note.dataset.cx = startX
    note.style.cursor = 'pointer'
    note.addEventListener('click', () => onSelect(index))
    g.appendChild(note)
  })

  const trackY2 = { 1: 62, 2: 136, 3: 211 }
  const seen = new Set()
  events.forEach(event => {
    if (seen.has(event.track)) return
    seen.add(event.track)
    const highlightL = document.createElementNS(svgNS, 'line')
    highlightL.setAttribute('x1', -700); highlightL.setAttribute('y1', trackY2[event.track] - 10)
    highlightL.setAttribute('x2', svgWidth); highlightL.setAttribute('y2', trackY2[event.track] - 10)
    highlightL.setAttribute('stroke', '#ff910091'); highlightL.setAttribute('stroke-width', 25)
    g.insertBefore(highlightL, rect)
  })

  svg.appendChild(g)
  return { svg, translateX, xSpacer }
}

// ---------------------------------------------------------------------------
// selectEvent()
// Central selection handler — called by map markers, timeline spans, cards.
// Updates the card panel, pans the map, and scrolls the timeline ruler.
// ---------------------------------------------------------------------------
function selectEvent(index, events, map, svgInfo, onSelect) {
  const event = events[index]

  buildCard(event, index, events, onSelect)
  map.setView([event.lat, event.lon], 14)

  // Reset all spans to default colour
  document.querySelectorAll('.event-span').forEach(span => {
    span.setAttribute('fill', '#e61edca1')
    span.setAttribute('stroke', '#96008ea1')
  })

  // Highlight active span
  const activeSpan = document.querySelector(`.event-span[data-index="${index}"]`)
  if (activeSpan) {
    activeSpan.setAttribute('fill', '#96008ea1')
    activeSpan.setAttribute('stroke', '#70006ba1')

    // Scroll timeline ruler so active span is centred
    const spanCX = parseFloat(activeSpan.dataset.cx)
    const scrollTarget = (spanCX + svgInfo.translateX) - window.innerWidth / 2
    document.getElementById('timeline-ruler').scrollLeft = scrollTarget
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const events = await parseEvents()
events.sort((a, b) => a.astronomicalYear - b.astronomicalYear)

const onSelect = (index) => selectEvent(index, events, map, svgInfo, onSelect)

const map = buildMap(events, onSelect)

// Build fixed left panel (does not scroll)
buildFixedPanel(events, 260)

// Build scrollable ruler
const { svg, translateX, xSpacer } = buildTimelineSVG(events, onSelect)
const svgInfo = { translateX, xSpacer }
document.getElementById('timeline-ruler').appendChild(svg)

// Show the first event's card on load
selectEvent(0, events, map, svgInfo, onSelect)