const d3 = require('d3')
const fs = require('fs')
const path = require('path')
const { directoryPath } = require('../config')

function renderAlternativeRadars(radarFooter) {
  const alternativesContainer = radarFooter.append('div').classed('alternative-radars', true)

  const filePath = path.join(directoryPath, 'alternative_radars.json')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  for (let i = 0; data.length > 0; i++) {
    const list = data.splice(0, 5)

    const alternativesList = alternativesContainer
      .append('ul')
      .classed(`alternative-radars__list`, true)
      .classed(`alternative-radars__list__row-${i}`, true)

    list.forEach(function (alternative) {
      const alternativeListItem = alternativesList.append('li').classed('alternative-radars__list-item', true)

      alternativeListItem
        .append('a')
        .classed('alternative-radars__list-item-link', true)
        .attr('href', '#')
        .attr('role', 'tab')
        .text(alternative)
    })
  }
}

module.exports = {
  renderAlternativeRadars,
}
