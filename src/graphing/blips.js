const Chance = require('chance')
const { graphConfig } = require('./config')
const { toRadian } = require('../util/mathUtils')
const { renderBlipDescription } = require('./components/quadrantTables')
const Blip = require('../models/blip')

const getRingRadius = function (ringIndex) {
  const ratios = [0, 0.316, 0.652, 0.832, 0.992]
  const radius = ratios[ringIndex] * graphConfig.quadrantWidth
  return radius || 0
}

function getBorderWidthOffset(quadrantOrder, adjustY, adjustX) {
  let borderWidthYOffset = 0,
    borderWidthXOffset = 0

  if (quadrantOrder !== 'first') {
    borderWidthYOffset = adjustY < 0 ? 0 : graphConfig.quadrantsGap
    borderWidthXOffset = adjustX > 0 ? graphConfig.quadrantsGap : 0
  }
  return { borderWidthYOffset, borderWidthXOffset }
}

function calculateRadarBlipCoordinates(minRadius, maxRadius, startAngle, quadrantOrder, chance, blip) {
  const adjustX = Math.sin(toRadian(startAngle)) - Math.cos(toRadian(startAngle))
  const adjustY = -Math.cos(toRadian(startAngle)) - Math.sin(toRadian(startAngle))
  const { borderWidthYOffset, borderWidthXOffset } = getBorderWidthOffset(quadrantOrder, adjustY, adjustX)
  const radius = chance.floating({
    min: minRadius + blip.width / 2,
    max: maxRadius - blip.width,
  })

  let angleDelta = (Math.asin(blip.width / 2 / radius) * 180) / (Math.PI - 1.25)
  angleDelta = angleDelta > 45 ? 45 : angleDelta
  const angle = toRadian(chance.integer({ min: angleDelta, max: 90 - angleDelta }))

  let x = graphConfig.quadrantWidth + radius * Math.cos(angle) * adjustX + borderWidthXOffset
  let y = graphConfig.quadrantHeight + radius * Math.sin(angle) * adjustY + borderWidthYOffset

  return avoidBoundaryCollision(x, y, adjustX, adjustY)
}

function thereIsCollision(coordinates, allCoordinates, blipWidth) {
  return allCoordinates.some(function (currentCoordinates) {
    return (
      Math.abs(currentCoordinates.coordinates[0] - coordinates[0]) <
        currentCoordinates.width / 2 + blipWidth / 2 + 10 &&
      Math.abs(currentCoordinates.coordinates[1] - coordinates[1]) < currentCoordinates.width / 2 + blipWidth / 2 + 10
    )
  })
}

function avoidBoundaryCollision(x, y, adjustX, adjustY) {
  const size = graphConfig.quadrantWidth * 2 + graphConfig.quadrantsGap
  if (
    (adjustY > 0 && y + graphConfig.blipWidth > size) ||
    (adjustY < 0 && y + graphConfig.blipWidth > graphConfig.quadrantHeight)
  ) {
    y = y - graphConfig.blipWidth
  }
  if (adjustX < 0 && x - graphConfig.blipWidth > graphConfig.quadrantWidth) {
    x += graphConfig.blipWidth
  }
  if (adjustX > 0 && x + graphConfig.blipWidth < graphConfig.quadrantWidth + graphConfig.quadrantsGap) {
    x -= graphConfig.blipWidth
  }
  return [x, y]
}

function findBlipCoordinates(blip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing, quadrantOrder) {
  const maxIterations = 200
  const chance = new Chance(
    Math.PI *
      graphConfig.quadrantWidth *
      graphConfig.quadrantHeight *
      graphConfig.quadrantsGap *
      graphConfig.blipWidth *
      maxIterations,
  )
  let coordinates = calculateRadarBlipCoordinates(minRadius, maxRadius, startAngle, quadrantOrder, chance, blip)
  let iterationCounter = 0
  let foundAPlace = false

  while (iterationCounter < maxIterations) {
    if (thereIsCollision(coordinates, allBlipCoordinatesInRing, blip.width)) {
      coordinates = calculateRadarBlipCoordinates(minRadius, maxRadius, startAngle, quadrantOrder, chance, blip)
    } else {
      foundAPlace = true
      break
    }
    iterationCounter++
  }

  if (!foundAPlace && blip.width > graphConfig.minBlipWidth) {
    blip.width = blip.width - 1
    blip.scale = Math.max((blip.scale || 1) - 0.1, 0.7)
    return findBlipCoordinates(blip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing, quadrantOrder)
  } else {
    return coordinates
  }
}

function blipAssistiveText(blip) {
  return `${blip.ring().name()} ring, ${blip.name()}, ${blip.isNew() ? 'New' : 'No change'} blip.`
}
function addOuterCircle(parentSvg, order, scale = 1) {
  parentSvg
    .append('path')
    .attr('opacity', '1')
    .attr('class', order)
    .attr(
      'd',
      'M18 36C8.07 36 0 27.93 0 18S8.07 0 18 0c9.92 0 18 8.07 18 18S27.93 36 18 36zM18 3.14C9.81 3.14 3.14 9.81 3.14 18S9.81 32.86 18 32.86S32.86 26.19 32.86 18S26.19 3.14 18 3.14z',
    )
    .style('transform', `scale(${scale})`)
}

function drawBlipCircle(group, blip, xValue, yValue, order) {
  group
    .attr('transform', `scale(1) translate(${xValue - 16}, ${yValue - 16})`)
    .attr('aria-label', blipAssistiveText(blip))
  group
    .append('circle')
    .attr('r', '12')
    .attr('cx', '18')
    .attr('cy', '18')
    .attr('class', order)
    .style('transform', `scale(${blip.scale || 1})`)
}

function newBlip(blip, xValue, yValue, order, group) {
  drawBlipCircle(group, blip, xValue, yValue, order)
  addOuterCircle(group, order, blip.scale)
}

function noChangeBlip(blip, xValue, yValue, order, group) {
  drawBlipCircle(group, blip, xValue, yValue, order)
}

function pillBlip(blip, xValue, yValue, order, group) {
  group.attr('transform', `scale(1) translate(${xValue}, ${yValue})`).attr('aria-label', blipAssistiveText(blip))
  group
    .append('rect')
    .attr('x', '1')
    .attr('y', '1')
    .attr('rx', '12')
    .attr('ry', '12')
    .attr('width', '64')
    .attr('height', '24')
    .attr('fill', 'red')
    .attr('class', order)
    .style('transform', `scale(${blip.scale || 1})`)
}

function drawBlipInCoordinates(blip, coordinates, order, quadrantGroup) {
  let x = coordinates[0]
  let y = coordinates[1]

  const number = blip.number().toString().replace(/\s+/g, '')
  const group = quadrantGroup
    .append('g')
    .append('a')
    .attr('href', 'javascript:void(0)')
    .attr('class', 'blip-link')
    .attr('id', 'blip-link-' + number)
    .attr('data-blip-id', number)

  if (blip.isGroup()) {
    pillBlip(blip, x, y, order, group)
  } else if (blip.isNew()) {
    newBlip(blip, x, y, order, group)
  } else {
    noChangeBlip(blip, x, y, order, group)
  }

  group
    .append('text')
    .attr('x', blip.isGroup() ? 32 : 18)
    .attr('y', blip.isGroup() ? 17 : 23)
    .style('font-size', '12px')
    .attr('font-style', 'normal')
    .attr('font-weight', 'bold')
    .attr('fill', 'white')
    .text(blip.number())
    .style('text-anchor', 'middle')
    .style('transform', `scale(${blip.scale || 1})`)
}

function getPillBlipTooltipText(ringBlips) {
  let tooltipText = 'Click to view all'
  if (ringBlips.length <= 15) {
    tooltipText = ringBlips.reduce((acc, itr) => {
      acc += itr.number() + '.' + itr.name() + '</br>'
      return acc
    }, '')
  }
  return tooltipText
}

const plotRadarBlips = function (parentElement, rings, quadrantWrapper, tooltip) {
  let blips, quadrant, startAngle, order

  quadrant = quadrantWrapper.quadrant
  startAngle = quadrantWrapper.startAngle
  order = quadrantWrapper.order
  const maxBlipsInRings = [8, 22, 18, 18]

  blips = quadrant.blips()
  rings.forEach(function (ring, i) {
    const ringBlips = blips.filter(function (blip) {
      return blip.ring() === ring
    })

    if (ringBlips.length === 0) {
      return
    }

    const offset = 10
    const minRadius = getRingRadius(i) + offset
    const maxRadius = getRingRadius(i + 1) - offset
    const allBlipCoordinatesInRing = []

    if (ringBlips.length > maxBlipsInRings[i]) {
      const pillBlipText = `${ringBlips.length} blips`
      const pillBlip = new Blip(pillBlipText, ring, false, '', '')
      pillBlip.setNumber(pillBlipText)
      pillBlip.setIsGroup(true)
      const pillBlipTooltipText = getPillBlipTooltipText(ringBlips)
      const coords = findBlipCoordinates(pillBlip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing, order)
      drawBlipInCoordinates(pillBlip, coords, order, parentElement)
      renderBlipDescription(pillBlip, ring, quadrantWrapper, tooltip, pillBlipTooltipText)
      ringBlips.forEach(function (blip) {
        renderBlipDescription(blip, ring, quadrantWrapper, tooltip)
      })
      return
    }

    ringBlips.forEach(function (blip) {
      const coordinates = findBlipCoordinates(blip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing, order)
      allBlipCoordinatesInRing.push({ coordinates, width: blip.width })
      drawBlipInCoordinates(blip, coordinates, order, parentElement)
      renderBlipDescription(blip, ring, quadrantWrapper, tooltip)
    })
  })
}

module.exports = { calculateRadarBlipCoordinates, plotRadarBlips, getRingRadius }
