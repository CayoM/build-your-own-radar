const fs = require('fs');
const path = require('path');
const { directoryPath } = require('../config');

function renderButtons(radarFooter) {
  const buttonsRow = radarFooter.append('div').classed('buttons', true);

  buttonsRow
    .append('button')
    .classed('buttons__wave-btn', true)
    .text('Print this Radar')
    .on('click', window.print.bind(window));

  buttonsRow
    .append('a')
    .classed('buttons__flamingo-btn', true)
    .attr('href', window.location.href.substring(0, window.location.href.indexOf(window.location.search)))
    .text('Generate new Radar');

  const filePath = path.join(directoryPath, 'buttons.json');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.forEach(button => {
      buttonsRow
        .append('button')
        .classed(button.class, true)
        .text(button.text)
        .on('click', () => {
          window.location.href = button.url;
        });
    });
  }
}

module.exports = {
  renderButtons,
};
