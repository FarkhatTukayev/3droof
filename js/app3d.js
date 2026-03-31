const scene = new THREE.Scene();
let camera, renderer, labelRenderer, controls;
let roofMeshes = [];
let labelMeshes = [];

function init3D() {
    const container = document.getElementById('canvas-container');
    camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    container.appendChild(renderer.domElement);

    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 150;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(20, 40, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.5);
    fillLight.position.set(-20, 20, -20);
    scene.add(fillLight);

    const gridHelper = new THREE.GridHelper(80, 80, 0x94a3b8, 0xe2e8f0);
    gridHelper.material.opacity = 0.5;
    gridHelper.material.transparent = true;
    gridHelper.position.y = -2.51;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.05 });
    const groundObj = new THREE.Mesh(groundGeo, groundMat);
    groundObj.rotation.x = -Math.PI / 2;
    groundObj.position.y = -2.51;
    groundObj.receiveShadow = true;
    scene.add(groundObj);

    animate();
}

function createGableShape(w, h) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(w / 2, h);
    shape.lineTo(w, 0);
    shape.lineTo(0, 0);
    return shape;
}

function createRoofMesh(shape, depth, colorHex) {
    const extrudeSettings = { depth: depth, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.computeBoundingBox();
    const bBox = geometry.boundingBox;
    geometry.translate(-(bBox.max.x - bBox.min.x) / 2, 0, -(bBox.max.z - bBox.min.z) / 2);

    const material = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.7,
        metalness: 0.2,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.15, transparent: true }));
    mesh.add(line);

    return mesh;
}

function build3DModel() {
    if (!window.needs3DUpdate) return;
    window.needs3DUpdate = false;

    const baseLen = parseFloat(document.getElementById('length').value) || 10;
    const baseWid = parseFloat(document.getElementById('width').value) || 8;
    const overhang = parseFloat(document.getElementById('overhang').value) || 0;
    const len = baseLen + (2 * overhang);
    const wid = baseWid + (2 * overhang);
    const angleDeg = parseFloat(document.getElementById('angle').value) || 30;

    roofMeshes.forEach(m => scene.remove(m));
    roofMeshes = [];
    labelMeshes.forEach(m => scene.remove(m));
    labelMeshes = [];

    const currentMaterialValue = document.getElementById('material').value;
    const roofColor = window.materialColorMap?.[currentMaterialValue] || 0x1e293b;

    const height = Math.tan(angleDeg * Math.PI / 180) * (wid / 2);
    const shapeType = document.getElementById('roofShape').value;

    let mainRoofGeo;
    const extrudeSettings = { depth: len, bevelEnabled: false };

    if (shapeType === 'gable') {
        const shape = createGableShape(wid, height);
        mainRoofGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        mainRoofGeo.translate(-wid / 2, 0, -len / 2);
    } else if (shapeType === 'shed') {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(0, height * 2);
        shape.lineTo(wid, 0);
        shape.lineTo(0, 0);
        mainRoofGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        mainRoofGeo.translate(-wid / 2, 0, -len / 2);
    } else if (shapeType === 'flat') {
        mainRoofGeo = new THREE.BoxGeometry(wid, 0.4, len);
        mainRoofGeo.translate(0, 0.2, 0);
    } else {
        const geom = new THREE.BufferGeometry();
        let inset1, h1, inset2, h2;
        if (shapeType === 'hip') {
            inset1 = Math.min(wid, len) / 2;
            h1 = inset1 * Math.tan(angleDeg * Math.PI / 180);
            inset2 = inset1;
            h2 = h1;
        } else {
            const lowerPitch = Math.max(45, angleDeg);
            const upperPitch = 15;
            h1 = 2.5;
            inset1 = h1 / Math.tan(lowerPitch * Math.PI / 180);
            if (inset1 > Math.min(wid, len) / 2.5) {
                inset1 = Math.min(wid, len) / 2.5;
                h1 = inset1 * Math.tan(lowerPitch * Math.PI / 180);
            }
            inset2 = Math.min(wid, len) / 2;
            h2 = h1 + (inset2 - inset1) * Math.tan(upperPitch * Math.PI / 180);
        }
        const w2 = wid / 2; const l2 = len / 2;
        const v = new Float32Array([
            -w2, 0, -l2, w2, 0, -l2, w2, 0, l2, -w2, 0, l2,
            -w2 + inset1, h1, -l2 + inset1, w2 - inset1, h1, -l2 + inset1, w2 - inset1, h1, l2 - inset1, -w2 + inset1, h1, l2 - inset1,
            -w2 + inset2, h2, -l2 + inset2, w2 - inset2, h2, -l2 + inset2, w2 - inset2, h2, l2 - inset2, -w2 + inset2, h2, l2 - inset2,
        ]);
        geom.setAttribute('position', new THREE.BufferAttribute(v, 3));
        let indices = [0, 5, 1, 0, 4, 5, 1, 6, 2, 1, 5, 6, 2, 7, 3, 2, 6, 7, 3, 4, 0, 3, 7, 4];
        if (shapeType === 'mansard') {
            indices.push(4, 9, 5, 4, 8, 9, 5, 10, 6, 5, 9, 10, 6, 11, 7, 6, 10, 11, 7, 8, 4, 7, 11, 8, 8, 10, 9, 8, 11, 10);
        } else {
            indices.push(4, 6, 5, 4, 7, 6);
        }
        geom.setIndex(indices);
        geom.computeVertexNormals();
        mainRoofGeo = geom;
    }

    const material = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide });
    const mainRoof = new THREE.Mesh(mainRoofGeo, material);
    mainRoof.castShadow = true;
    mainRoof.receiveShadow = true;

    const edges = new THREE.EdgesGeometry(mainRoofGeo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.15, transparent: true }));
    mainRoof.add(line);
    scene.add(mainRoof);
    roofMeshes.push(mainRoof);

    const baseGeo = new THREE.BoxGeometry(baseWid, 5, baseLen);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 1.0 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -2.5, 0);
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    scene.add(baseMesh);
    roofMeshes.push(baseMesh);

    const lBadge = new THREE.CSS2DObject(createBadge(`${baseLen} м`));
    lBadge.position.set(baseWid / 2 + 0.1, -2.5, 0);
    scene.add(lBadge);
    labelMeshes.push(lBadge);

    const wBadge = new THREE.CSS2DObject(createBadge(`${baseWid} м`));
    wBadge.position.set(0, -2.5, baseLen / 2 + 0.1);
    scene.add(wBadge);
    labelMeshes.push(wBadge);

    if (shapeType === 'gable' || shapeType === 'hip') {
        window.dormerConfig.forEach((dormer) => {
            const dH = Math.tan(angleDeg * Math.PI / 180) * (dormer.width / 2);
            const dRoof = createRoofMesh(createGableShape(dormer.width, dH), dormer.projection + (wid / 2), roofColor);
            dRoof.rotation.y = Math.PI / 2;
            const shiftOut = (wid / 2) + (dormer.projection / 2) - ((dormer.projection + (wid / 2)) / 2) - 0.05;
            dRoof.position.set(shiftOut, 0, dormer.position);
            scene.add(dRoof);
            roofMeshes.push(dRoof);

            const dBase = new THREE.Mesh(new THREE.BoxGeometry(dormer.projection + (wid / 2) - 0.2, 5, dormer.width - 0.4), baseMat);
            dBase.position.set(shiftOut - 0.1, -2.5, dormer.position);
            dBase.receiveShadow = true; dBase.castShadow = true;
            scene.add(dBase);
            roofMeshes.push(dBase);
        });
    }

    const maxDim = Math.max(len, wid);
    controls.target.set(0, height / 2, 0);
    if (!window.cameraInitialized) {
        camera.position.set(maxDim * 1.5, maxDim * 0.8, maxDim * 1.5);
        window.cameraInitialized = true;
    }
}

function createBadge(text) {
    const div = document.createElement('div');
    div.className = 'dimension-badge';
    div.textContent = text;
    return div;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (window.needs3DUpdate) build3DModel();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-container');
    if (container.clientWidth && container.clientHeight) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        labelRenderer.setSize(container.clientWidth, container.clientHeight);
    }
});
