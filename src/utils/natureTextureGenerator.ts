import * as THREE from 'three';

/**
 * 纯程序化高拟真生成：雨林湿润青苔泥土 + 水洼倒影 + 散落枯竹叶 PBR 材质
 * 包含：Albedo (色彩纹理), Normal (微凹凸法线), Roughness (水洼镜面反光)
 */
export function createMossyGroundTextures() {
  const size = 1024;

  // 1. Albedo (底色画布)
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  // 2. Normal (法线画布)
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d')!;

  // 3. Roughness (粗糙度与水洼画布)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // A. 基础湿润黑褐泥土
  aCtx.fillStyle = '#222822';
  aCtx.fillRect(0, 0, size, size);

  // 基础粗糙度：泥土偏哑光 (中高灰，粗糙度约 0.8)
  rCtx.fillStyle = '#b0b0b0';
  rCtx.fillRect(0, 0, size, size);

  // 基础平坦法线
  nCtx.fillStyle = '#8080ff';
  nCtx.fillRect(0, 0, size, size);

  // B. 绘制自然斑驳的青翠苔藓群落 (Moss Patches)
  const mossColors = ['#2e4732', '#3a593e', '#486e4b', '#253d29'];
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const rad = 60 + Math.random() * 140;

    const grad = aCtx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    const color = mossColors[i % mossColors.length];
    grad.addColorStop(0, color);
    grad.addColorStop(0.6, color);
    grad.addColorStop(1, 'rgba(34, 40, 34, 0)');

    aCtx.fillStyle = grad;
    aCtx.beginPath();
    aCtx.arc(cx, cy, rad, 0, Math.PI * 2);
    aCtx.fill();
  }

  // C. 泥土与石砾微颗粒噪点
  const imgData = aCtx.getImageData(0, 0, size, size);
  const pixels = imgData.data;
  for (let p = 0; p < pixels.length; p += 4) {
    const noise = (Math.random() - 0.5) * 22;
    pixels[p] = Math.max(0, Math.min(255, pixels[p] + noise));
    pixels[p + 1] = Math.max(0, Math.min(255, pixels[p + 1] + noise * 1.2));
    pixels[p + 2] = Math.max(0, Math.min(255, pixels[p + 2] + noise));
  }
  aCtx.putImageData(imgData, 0, 0);

  // D. 散落满地的真实枯黄与鲜绿细长竹叶 (Fallen Bamboo Leaves)
  const leafColors = ['#8c7b45', '#a38d4a', '#697a47', '#506e3d', '#3e5c33'];
  for (let l = 0; l < 240; l++) {
    const lx = Math.random() * size;
    const ly = Math.random() * size;
    const len = 22 + Math.random() * 28;
    const width = 3 + Math.random() * 3;
    const angle = Math.random() * Math.PI * 2;

    aCtx.save();
    aCtx.translate(lx, ly);
    aCtx.rotate(angle);

    aCtx.fillStyle = leafColors[l % leafColors.length];
    aCtx.beginPath();
    aCtx.moveTo(-len / 2, 0);
    aCtx.quadraticCurveTo(0, width, len / 2, 0);
    aCtx.quadraticCurveTo(0, -width, -len / 2, 0);
    aCtx.fill();

    // 叶片主脉微亮线
    aCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    aCtx.lineWidth = 0.8;
    aCtx.beginPath();
    aCtx.moveTo(-len / 2, 0);
    aCtx.lineTo(len / 2, 0);
    aCtx.stroke();

    aCtx.restore();
  }

  // E. 绘制雨后自然积水水洼 (Rain Puddles) —— 水洼处粗糙度极低，光亮倒影如镜！
  for (let w = 0; w < 12; w++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const pr = 40 + Math.random() * 90;

    // 在水洼处让泥地颜色更深、更湿润
    const pGrad = aCtx.createRadialGradient(px, py, 0, px, py, pr);
    pGrad.addColorStop(0, 'rgba(15, 20, 16, 0.65)');
    pGrad.addColorStop(0.7, 'rgba(20, 26, 21, 0.4)');
    pGrad.addColorStop(1, 'rgba(20, 26, 21, 0)');
    aCtx.fillStyle = pGrad;
    aCtx.beginPath();
    aCtx.arc(px, py, pr, 0, Math.PI * 2);
    aCtx.fill();

    // 在粗糙度贴图上，将水洼区域画为深黑 (黑色 = 极度光滑镜面反光)
    const rGrad = rCtx.createRadialGradient(px, py, 0, px, py, pr);
    rGrad.addColorStop(0, '#101010'); // 水洼中心如镜子
    rGrad.addColorStop(0.7, '#252525');
    rGrad.addColorStop(1, '#b0b0b0'); // 边缘平滑过渡到泥土
    rCtx.fillStyle = rGrad;
    rCtx.beginPath();
    rCtx.arc(px, py, pr, 0, Math.PI * 2);
    rCtx.fill();
  }

  // F. 生成泥土与青苔凹凸法线贴图 (Normal Map)
  const normImg = nCtx.getImageData(0, 0, size, size);
  const nData = normImg.data;
  for (let i = 0; i < nData.length; i += 4) {
    const nx = 128 + Math.floor((Math.random() - 0.5) * 32);
    const ny = 128 + Math.floor((Math.random() - 0.5) * 32);
    nData[i] = nx;     // Red: X 法线
    nData[i + 1] = ny; // Green: Y 法线
    nData[i + 2] = 255; // Blue: Z 朝上
    nData[i + 3] = 255;
  }
  nCtx.putImageData(normImg, 0, 0);

  const albedoTex = new THREE.CanvasTexture(albedoCanvas);
  albedoTex.wrapS = THREE.RepeatWrapping;
  albedoTex.wrapT = THREE.RepeatWrapping;
  albedoTex.repeat.set(6, 6);
  albedoTex.colorSpace = THREE.SRGBColorSpace;

  const normalTex = new THREE.CanvasTexture(normalCanvas);
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(6, 6);

  const roughTex = new THREE.CanvasTexture(roughCanvas);
  roughTex.wrapS = THREE.RepeatWrapping;
  roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(6, 6);

  return { albedoTex, normalTex, roughTex };
}

/**
 * 纯程序化生成：真实水体涟漪法线贴图 (Water Ripple Normal Map)
 * 用于让溪水泛出波光粼粼的折射水光与湍流流动感
 */
export function createWaterNormalTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 叠加多频正弦波与微波
      const u = (x / size) * Math.PI * 8;
      const v = (y / size) * Math.PI * 8;

      const waveX = Math.sin(u + Math.sin(v * 1.5)) * 0.5 + Math.sin(u * 2.2 + v * 0.8) * 0.3;
      const waveY = Math.cos(v + Math.cos(u * 1.5)) * 0.5 + Math.cos(v * 2.5 + u * 1.1) * 0.3;

      // 转换为法线颜色空间 (0~255)
      const r = Math.floor(128 + waveX * 60);
      const g = Math.floor(128 + waveY * 60);
      const b = 255;

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 8); // 沿狭长溪流纵向多次平铺
  return texture;
}
