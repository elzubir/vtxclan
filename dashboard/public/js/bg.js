/* Lightweight animated particle network for the VTX background. */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w;
  let h;
  let particles = [];
  const COLORS = ['#ff5fb6', '#8b5cff', '#38f0d8'];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const count = Math.min(90, Math.floor((w * h) / 18000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.6,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
  }

  function step() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.7;
      ctx.fill();

      for (let j = i + 1; j < particles.length; j += 1) {
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = p.c;
          ctx.globalAlpha = (1 - dist / 130) * 0.18;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(step);
  }

  window.addEventListener('resize', resize);
  resize();
  step();
})();
