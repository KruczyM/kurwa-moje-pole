/** Bottle colours and fruits follow the user's cherry, peach and apple photographic references. */
export const AMARENA_FLAVOURS = [
  { name: 'wiśnia', wine: '#66162b', label: '#c23631', fruit: '#bb183c' },
  { name: 'brzoskwinia', wine: '#c48b33', label: '#df8d34', fruit: '#f3b34d' },
  { name: 'jabłko', wine: '#d2b65b', label: '#c8c054', fruit: '#cb3c52' },
] as const;

/** Draws a whole slender glass bottle, golden cap, black Amarena band and fruit label in a 64px tile. */
export function drawAmarena(ctx: CanvasRenderingContext2D, variant: number): void {
  const flavour = AMARENA_FLAVOURS[((variant % 3) + 3) % 3];
  ctx.save();
  ctx.fillStyle = flavour.wine;
  ctx.strokeStyle = '#e7cc93';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(27, 7);
  ctx.lineTo(37, 7);
  ctx.lineTo(37, 19);
  ctx.bezierCurveTo(37, 25, 44, 25, 44, 33);
  ctx.lineTo(44, 56);
  ctx.quadraticCurveTo(32, 61, 20, 56);
  ctx.lineTo(20, 33);
  ctx.bezierCurveTo(20, 25, 27, 25, 27, 19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d7b269';
  ctx.fillRect(26, 5, 12, 5);
  ctx.fillStyle = flavour.label;
  ctx.fillRect(21, 31, 22, 23);
  ctx.fillStyle = '#151318';
  ctx.fillRect(20, 33, 24, 8);
  ctx.fillStyle = '#f7dd9b';
  ctx.font = '7px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Amarena', 32, 39, 23);
  ctx.fillStyle = flavour.fruit;
  for (const [x, y, r] of [
    [28, 47, 4.5],
    [35, 48, 5],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#568b42';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(28, 44);
  ctx.lineTo(34, 41);
  ctx.lineTo(35, 44);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff77';
  ctx.beginPath();
  ctx.moveTo(29, 12);
  ctx.lineTo(29, 21);
  ctx.moveTo(23, 27);
  ctx.lineTo(23, 32);
  ctx.stroke();
  ctx.restore();
}
