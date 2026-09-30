import * as THREE from "three"

/**
 * โรงงานสร้างโมเดล 3D แบบโพลีต่ำ (Procedural Low-Poly 3D Mesh Factory)
 * ตามหลักการ Decoupled Architecture เพื่อแยก Presentation Layer ออกจาก Game Logic
 */

/**
 * สร้าง 3D Mesh สำหรับตัวละครแมว (Cat Model)
 */
export function createCatMesh(color: number): THREE.Group {
  const group = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true })
  const pinkMat = new THREE.MeshLambertMaterial({
    color: 0xff9ff3,
    flatShading: true,
  })
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1e1e2e })

  // ลำตัว (Body)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.45, 4, 8), mat)
  body.position.y = 0.62
  group.add(body)

  // หัว (Head)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 7, 6), mat)
  head.position.y = 1.42
  group.add(head)

  // หูแมวซ้าย-ขวา (Ears)
  const earPositions = [-0.18, 0.18]
  for (let i = 0; i < earPositions.length; i++) {
    const ex = earPositions[i]
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), mat)
    ear.position.set(ex, 1.76, 0)
    ear.rotation.z = i === 0 ? 0.35 : -0.35
    group.add(ear)

    const innerEar = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.14, 4),
      pinkMat,
    )
    innerEar.position.set(ex, 1.76, 0.03)
    innerEar.rotation.z = i === 0 ? 0.35 : -0.35
    group.add(innerEar)
  }

  // ดวงตา (Eyes)
  const eyePositions = [-0.12, 0.12]
  for (let i = 0; i < eyePositions.length; i++) {
    const ex = eyePositions[i]
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), darkMat)
    eye.position.set(ex, 1.47, 0.29)
    group.add(eye)
  }

  // จมูก (Nose)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), pinkMat)
  nose.position.set(0, 1.38, 0.33)
  group.add(nose)

  // หางแมว (Tail)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.35, -0.42),
    new THREE.Vector3(-0.35, 0.75, -0.72),
    new THREE.Vector3(-0.15, 1.15, -0.92),
  ])
  const tail = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 8, 0.055, 5, false),
    mat,
  )
  group.add(tail)

  // เปิดใช้งานเงาสำหรับทุก Mesh
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true
    }
  })

  return group
}

/**
 * สร้าง 3D Mesh สำหรับตัวละครหนู (Mouse Model)
 */
export function createMouseMesh(color: number): THREE.Group {
  const group = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true })
  const pinkMat = new THREE.MeshLambertMaterial({
    color: 0xfab1d3,
    flatShading: true,
  })
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1e1e2e })
  const creamMat = new THREE.MeshLambertMaterial({
    color: 0xffeaa7,
    flatShading: true,
  })

  // ลำตัว (Body)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), mat)
  body.position.y = 0.58
  body.scale.set(1, 0.88, 1.1)
  group.add(body)

  // หัว (Head)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 6), mat)
  head.position.set(0, 1.15, 0.22)
  group.add(head)

  // ปากและจมูก (Snout)
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), creamMat)
  snout.position.set(0, 1.1, 0.48)
  snout.scale.set(1, 0.7, 0.65)
  group.add(snout)

  // ใบหูกลมซ้าย-ขวา (Round Ears)
  const earPositions = [-0.24, 0.24]
  for (let i = 0; i < earPositions.length; i++) {
    const ex = earPositions[i]
    const ear = new THREE.Mesh(new THREE.CircleGeometry(0.17, 9), mat)
    ear.position.set(ex, 1.46, 0.08)
    group.add(ear)

    const innerEar = new THREE.Mesh(new THREE.CircleGeometry(0.1, 9), pinkMat)
    innerEar.position.set(ex, 1.46, 0.09)
    group.add(innerEar)
  }

  // ดวงตา (Eyes)
  const eyePositions = [-0.1, 0.1]
  for (let i = 0; i < eyePositions.length; i++) {
    const ex = eyePositions[i]
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), darkMat)
    eye.position.set(ex, 1.19, 0.45)
    group.add(eye)
  }

  // จมูกสีชมพู (Pink Nose)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 5), pinkMat)
  nose.position.set(0, 1.1, 0.52)
  group.add(nose)

  // หางเรียวยาว (Long Thin Tail)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.38, -0.52),
    new THREE.Vector3(0.42, 0.18, -0.92),
    new THREE.Vector3(0.55, 0.1, -1.32),
    new THREE.Vector3(0.28, 0.07, -1.72),
  ])
  const tail = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 10, 0.035, 4, false),
    mat,
  )
  group.add(tail)

  // เปิดใช้งานเงา
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true
    }
  })

  return group
}

/**
 * สร้างตัวแสดงสถานะลูกระเบิดลอยเหนือหัว (Floating Bomb Indicator)
 */
export function createBombIndicator(): THREE.Group {
  const group = new THREE.Group()

  // ลูกระเบิดทรงกลม (Bomb Sphere)
  const bombMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    emissive: 0xff6600,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.6,
  })
  const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), bombMat)
  bomb.position.y = 2.4
  group.add(bomb)

  // ชนวนระเบิด (Fuse)
  const fuseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.67, 0),
    new THREE.Vector3(0.1, 2.8, 0),
    new THREE.Vector3(0.05, 2.95, 0),
  ])
  const fuseMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 })
  const fuse = new THREE.Mesh(
    new THREE.TubeGeometry(fuseCurve, 5, 0.03, 4, false),
    fuseMat,
  )
  group.add(fuse)

  // ประกายไฟที่ปลายชนวน (Spark Indicator)
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 6, 6),
    new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xff8800,
      emissiveIntensity: 2,
    }),
  )
  spark.position.set(0.05, 2.98, 0)
  group.add(spark)

  // แสงไฟกะพริบจากระเบิด (Point Light)
  const light = new THREE.PointLight(0xff6600, 1.5, 5)
  light.position.y = 2.4
  group.add(light)

  // เพิ่มเสาแสงนีออน Sky Beacon พุ่งขึ้นฟ้าช่วยระบุตำแหน่งคนถือระเบิดได้ทั่วสนาม
  group.add(createSkyBeacon())

  group.visible = false
  return group
}

/**
 * สร้างเห็ดตกแต่งฉาก (Decorative Mushroom)
 */
export function createMushroom(x: number, z: number): THREE.Group {
  const group = new THREE.Group()
  const stemMat = new THREE.MeshLambertMaterial({
    color: 0xffeaa7,
    flatShading: true,
  })
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 0.55, 6),
    stemMat,
  )
  stem.position.y = 0.28
  group.add(stem)

  const capColors = [0xff6b6b, 0xff9ff3, 0xff9f43, 0x6c5ce7, 0x00cec9]
  const capMat = new THREE.MeshLambertMaterial({
    color: capColors[Math.floor(Math.random() * capColors.length)],
    flatShading: true,
  })
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.55, 7), capMat)
  cap.position.y = 0.83
  group.add(cap)

  const scale = 0.6 + Math.random() * 0.9
  group.scale.setScalar(scale)
  group.position.set(x, 0, z)
  group.rotation.y = Math.random() * Math.PI * 2
  group.castShadow = true

  return group
}

/**
 * สร้างละอองดวงดาวลอยในฉาก (Star Field Particle)
 */
export function createStarField(count = 300): THREE.Points {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 100
    pos[i * 3 + 1] = 8 + Math.random() * 25
    pos[i * 3 + 2] = (Math.random() - 0.5) * 100
  }

  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.18,
    transparent: true,
    opacity: 0.7,
  })

  return new THREE.Points(geo, mat)
}

/**
 * สร้างเสาแสงและคลื่นเรดาร์พุ่งขึ้นฟ้าเหนือผู้ถือระเบิด (Sky Beacon & Radar Rings)
 * ช่วยให้ผู้เล่นทุกคนสามารถระบุพิกัดของผู้ถือระเบิดได้อย่างง่ายดายจากทุกระยะในฉาก 90x90m
 */
export function createSkyBeacon(): THREE.Group {
  const group = new THREE.Group()

  // 1. เสาแสงนีออนพุ่งขึ้นฟ้า 35 เมตร
  const beamGeo = new THREE.CylinderGeometry(0.18, 0.7, 35, 10, 1, true)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xff3b30,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
  const beam = new THREE.Mesh(beamGeo, beamMat)
  beam.position.y = 17.5
  beam.renderOrder = 980
  group.add(beam)

  // 2. วงแหวนเรดาร์ 3 ชั้น
  for (let i = 0; i < 3; i++) {
    const ringGeo = new THREE.RingGeometry(0.6 + i * 0.4, 0.8 + i * 0.4, 20)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.6 - i * 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 2.8 + i * 0.8
    ring.renderOrder = 981
    group.add(ring)
  }

  return group
}

/**
 * สร้าง Outline และ Silhouette ทะลุกำแพงตามสีประจำตัวละคร (Through-wall Colored Silhouette)
 * เมื่อผู้เล่นหลบหลังสิ่งกีดขวางหรือแพลตฟอร์ม จะมองเห็นขอบและเงามือ/รูปทรงสีประจำตัวละครทะลุออกมาได้ทันที
 */
export function createPlayerOutlineMesh(color: number): THREE.Group {
  const group = new THREE.Group()

  // 1. เปลือกนอก Wireframe Outline ตามสีประจำตัวละคร
  const outlineGeo = new THREE.CapsuleGeometry(0.52, 0.95, 6, 12)
  const wireframeMat = new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
    depthWrite: false,
  })
  const wireframeMesh = new THREE.Mesh(outlineGeo, wireframeMat)
  wireframeMesh.name = "outline_wireframe"
  wireframeMesh.position.y = 0.85
  wireframeMesh.renderOrder = 992
  group.add(wireframeMesh)

  // 2. เปลือกใน Silhouette เรืองแสงโปร่งแสง ให้เห็นรูปทรงตัวละครชัดเจนแม้อยู่หลังกำแพง
  const silhouetteGeo = new THREE.CapsuleGeometry(0.46, 0.85, 6, 10)
  const silhouetteMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
    depthTest: false,
    depthWrite: false,
  })
  const silhouetteMesh = new THREE.Mesh(silhouetteGeo, silhouetteMat)
  silhouetteMesh.name = "outline_silhouette"
  silhouetteMesh.position.y = 0.85
  silhouetteMesh.renderOrder = 991
  group.add(silhouetteMesh)

  return group
}

/**
 * สร้างป้ายชื่อ 3D ลอยเหนือหัวผู้เล่น (Floating Billboard Nameplate)
 * เรนเดอร์ชื่อและสีตัวละครลง Canvas แล้วแปลงเป็น Billboard Sprite ที่มองทะลุกำแพงได้ (depthTest: false)
 */
export function createPlayerNameplate(
  name: string,
  color: number,
  isLocal: boolean,
): THREE.Sprite {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext("2d")

  if (ctx) {
    const hexColor = "#" + color.toString(16).padStart(6, "0")

    // พื้นหลังมน (Rounded Pill Background)
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)"
    ctx.beginPath()
    ctx.roundRect(10, 10, 236, 44, 22)
    ctx.fill()

    // เส้นขอบตามสีตัวละคร
    ctx.strokeStyle = hexColor
    ctx.lineWidth = 4
    ctx.stroke()

    // วงกลมสัญลักษณ์สีตัวละคร
    ctx.fillStyle = hexColor
    ctx.beginPath()
    ctx.arc(36, 32, 10, 0, Math.PI * 2)
    ctx.fill()

    // ตัวอักษรชื่อผู้เล่น
    ctx.font = "bold 22px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "#ffffff"
    ctx.textBaseline = "middle"
    const displayName = isLocal ? `${name} (You)` : name
    const trimmed =
      displayName.length > 14 ? displayName.slice(0, 13) + "…" : displayName
    ctx.fillText(trimmed, 58, 33)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })

  const sprite = new THREE.Sprite(mat)
  sprite.name = "nameplate"
  sprite.scale.set(1.9, 0.48, 1)
  sprite.position.y = 2.45
  sprite.renderOrder = 998

  return sprite
}
