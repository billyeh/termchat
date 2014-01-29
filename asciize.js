var colors = require('./node_modules/blessed/lib/colors');

function asciize(image, width, height) {
  var countedColors = countColors(image, width, height)
    , ascii = ''
    , ansiColorCode
    , previousColor = -2;

  for (var i = 0; i < countedColors.length; i++) {
    ansiColorCode = sortColors(countedColors[i])[0].color;
    if (ansiColorCode !== previousColor) {
      ascii += '\033[38;5;' + ansiColorCode + 'm';
      previousColor = ansiColorCode;
    }
    ascii += '#';
  }

  return ascii + '\033[0m';
}

function sortColors(countedColors) {
  var sortedColors = []
    , color;

  for (color in countedColors) {
    sortedColors.push({'color': color, 'count': countedColors[color]});
  }
  return sortedColors.sort(s);

  function s(a, b) {
    if (a.count < b.count) {
      return 1;
    } else if (a.count > b.count) {
      return -1;
    }
    return 0;
  }
}

function countColors(image, width, height) {
  var colorCount = []
    , blockWidth  = image.width / width
    , blockHeight = image.height / height
    , index = 0
    , pixelIndex
    , pixelColor;

  for (var i = 0; i < image.pixels.length; i += 3) {
    pixelIndex = i / 3;
    index = Math.floor(pixelIndex / blockWidth) % width + 
            Math.floor(pixelIndex / image.width / blockHeight) * width;
    if (!colorCount[index]) {
      colorCount[index] = {};
    }
    pixelColor = colors.match(image.pixels[i], image.pixels[i + 1], image.pixels[i + 2]);
    if (!(pixelColor in colorCount[index])) {
      colorCount[index][pixelColor] = 0;
    }
    // Assign less weight to grayscale values for a more interesting picture
    if (pixelColor >= 232 || pixelColor === 59) {
      colorCount[index][pixelColor] += .5;
    } else {
      colorCount[index][pixelColor]++;
    }
  }

  return colorCount;
}

exports.asciize = asciize;
exports.sortColors = sortColors;
