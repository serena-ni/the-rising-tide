export function sumSines(x, time, terms) {
  let value = 0;
  for (const term of terms) {
    value += term.amplitude * Math.sin(x * term.frequency + time * term.speed + term.phase);
  }
  return value;
}

export function waveHeight(x, time, config) {
  const harmonic = sumSines(x, time, config.terms);

  const crestBase = (Math.sin(x * config.crestFrequency + time * config.crestSpeed) + 1) * 0.5;
  const crest = Math.pow(crestBase, config.crestSharpness) * config.crestAmplitude;

  return config.baseY + harmonic - crest;
}

export function currentField(x, y, time) {
  const u1 = Math.sin(x * 0.008 + time * 1.35) * Math.cos(y * 0.012 - time * 0.9);
  const u2 = Math.sin((x + y) * 0.004 - time * 0.65);
  const v1 = Math.cos(x * 0.007 - time * 1.05) * Math.sin(y * 0.010 + time * 0.7);
  const v2 = Math.sin((x - y) * 0.003 + time * 0.95);

  return {
    x: (u1 + 0.7 * u2) * 14,
    y: (v1 + 0.6 * v2) * 8
  };
}

export function drawWaveBand(graphics, width, height, time, options) {
  const {
    fillColor,
    fillAlpha,
    lineColor,
    lineAlpha,
    lineWidth,
    sampleStep,
    waveConfig
  } = options;

  graphics.clear();

  graphics.fillStyle(fillColor, fillAlpha);
  graphics.beginPath();
  graphics.moveTo(0, height);

  for (let x = 0; x <= width; x += sampleStep) {
    const y = waveHeight(x, time, waveConfig);
    graphics.lineTo(x, y);
  }

  graphics.lineTo(width, height);
  graphics.closePath();
  graphics.fillPath();

  graphics.lineStyle(lineWidth, lineColor, lineAlpha);
  graphics.beginPath();

  for (let x = 0; x <= width; x += sampleStep) {
    const y = waveHeight(x, time, waveConfig);
    if (x === 0) graphics.moveTo(x, y);
    else graphics.lineTo(x, y);
  }

  graphics.strokePath();
}
