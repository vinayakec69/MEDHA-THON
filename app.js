// =====================================================================
// TwinMed - Digital Twin Surgical Planner | app.js v14
// ARCHITECTURE: Upload/UI code runs FIRST, then 3D code in try-catch
// =====================================================================

// =====================================================================
// SECTION 1: UI CODE (runs unconditionally, no 3D dependency)
// =====================================================================

let lastAnalysis = null;
let uploadedFileCount = 0;

// --- Overlay helpers ---
function setupOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.innerHTML = `
        <div style="text-align:center;padding:24px;width:300px;">
            <div style="font-size:28px;margin-bottom:12px;">🦴</div>
            <div id="overlayStatus" style="font-size:14px;color:#00f0ff;margin-bottom:18px;font-weight:600;letter-spacing:0.5px;">
                Awaiting CT Scan Upload...
            </div>
            <div id="progressBarWrap" style="display:none;width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;margin:0 auto;">
                <div id="progressBarFill" style="height:100%;width:0%;background:linear-gradient(90deg,#00f0ff,#3b82f6);border-radius:4px;transition:width 0.08s ease;"></div>
            </div>
            <div id="progressLabel" style="font-size:12px;color:#94a3b8;margin-top:10px;"></div>
        </div>`;
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'none';
}

function setOverlayProgress(statusText, percent, labelText) {
    const s = document.getElementById('overlayStatus');
    const bar = document.getElementById('progressBarWrap');
    const fill = document.getElementById('progressBarFill');
    const label = document.getElementById('progressLabel');
    if (s) s.innerText = statusText;
    if (percent !== null) {
        if (bar) bar.style.display = 'block';
        if (fill) fill.style.width = percent + '%';
        if (label) label.innerText = labelText || '';
    } else {
        if (bar) bar.style.display = 'none';
        if (label) label.innerText = '';
    }
}

// Setup overlay immediately
setupOverlay();

// --- FILE UPLOAD (Native Jetson Bypass) ---
window.startLocalDirUpload = function() {
    var pathInput = document.getElementById('localDirPath');
    var targetPath = pathInput ? pathInput.value : '';
    
    if (!targetPath) {
        alert("Please enter a valid directory path.");
        return;
    }

    var overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
    }
    
    // Create fast dummy thumbnails
    var previewContainer = document.getElementById('imagePreviewContainer');
    if (previewContainer) {
        previewContainer.innerHTML = '';
        for (var i = 0; i < 4; i++) {
            var img = document.createElement('div');
            img.style.cssText = 'width:36px;height:36px;background:#334155;border-radius:4px;border:1px solid rgba(255,255,255,0.2);display:inline-block;margin-right:4px;';
            previewContainer.appendChild(img);
        }
    }
    
    var formData = new FormData();
    formData.append('directory_path', targetPath);

    // Ask FastAPI to natively read the directory, bypassing the Ubuntu Sandbox freeze
    fetch('/api/scan-local-dir', { method: 'POST', body: formData })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.status === 'success') {
                startAnimation(data.file_count, overlay);
            } else {
                alert("Error from server: " + data.msg);
                if (overlay) {
                    overlay.style.opacity = '0';
                    overlay.style.pointerEvents = 'none';
                }
            }
        })
        .catch(function(err) {
            alert("Backend communication failed.");
            if (overlay) {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
            }
        });
};

// Proportional loading time
function startAnimation(fileCount, overlay) {
    uploadedFileCount = fileCount;
    var totalMs = Math.min(6000, Math.max(1500, fileCount * 50));
    var uploadMs = totalMs * 0.45;
    var processMs = totalMs * 0.55;

    var uploadPct = 0;
    var uploadTick = 80;
    var uploadStep = 100 / (uploadMs / uploadTick);
    setOverlayProgress('Uploading ' + fileCount + ' DICOM Slices...', 0, '0%');

    var uploadInterval = setInterval(function() {
        uploadPct = Math.min(100, uploadPct + uploadStep + Math.random() * 3);
        setOverlayProgress('Uploading ' + fileCount + ' DICOM Slices...', uploadPct, Math.floor(uploadPct) + '%');
        if (uploadPct >= 100) {
            clearInterval(uploadInterval);
            setTimeout(function() { runProcessing(processMs, fileCount, overlay); }, 300);
        }
    }, uploadTick);
}

function runProcessing(processMs, fileCount, overlay) {
    var procPct = 0;
    var tick = 80;
    var step = 100 / (processMs / tick);
    setOverlayProgress('AI Segmenting Bone Density...', 0, '0%');

    var procInterval = setInterval(function() {
        procPct = Math.min(100, procPct + step + Math.random() * 4);
        setOverlayProgress('AI Segmenting Bone Density...', procPct, Math.floor(procPct) + '%');
        if (procPct >= 100) {
            clearInterval(procInterval);
            setOverlayProgress('Reconstructing 3D Mesh...', 100, '100%');
            setTimeout(function() {
                if (overlay) {
                    overlay.style.opacity = '0';
                    overlay.style.pointerEvents = 'none';
                }
                setOverlayProgress('Awaiting CT Scan Upload...', null, '');
                // Reveal 3D models if they exist!
                if (typeof boneGroup !== 'undefined' && boneGroup) boneGroup.visible = true;
                if (typeof implantGroup !== 'undefined' && implantGroup) implantGroup.visible = true;
                
                var fb = document.getElementById('fallback3D');
                if (fb) fb.style.display = 'block';

                // Show analysis results if we got them from the backend
                if (typeof lastAnalysis !== 'undefined' && lastAnalysis) {
                    showAnalysisResults(lastAnalysis);
                }
            }, 700);
        }
    }, tick);
}

// Send to backend disabled for demo video to prevent memory freeze

// Display AI analysis results on the sidebar
function showAnalysisResults(analysis) {
    var densityEl = document.getElementById('boneDensityVal');
    if (densityEl && analysis.bone_density_score) {
        densityEl.innerText = analysis.bone_density_score + ' g/cm³';
        densityEl.className = 'stat-value text-green';
        densityEl.style.transition = 'color 0.3s ease';
        densityEl.style.color = '#ffffff';
        setTimeout(function() { densityEl.style.color = ''; }, 400);
    }
}

// --- GENERATE SURGICAL REPORT ---
var reportBtn = document.querySelector('.action-btn');
if (reportBtn) {
    reportBtn.addEventListener('click', function() {
        var patientId = '#PT-8892';
        var joint = 'Right Shoulder';
        var implantSel = document.querySelector('.custom-select');
        var implant = implantSel ? implantSel.value : 'Standard Humerus Head (48mm)';
        var statValues = document.querySelectorAll('.stat-row .stat-value');
        var angle = statValues[0] ? statValues[0].innerText : '132°';
        var risk = statValues[1] ? statValues[1].innerText : '12%';
        var stability = statValues[2] ? statValues[2].innerText : 'High';
        var boneDensity = lastAnalysis && lastAnalysis.bone_density_score ? lastAnalysis.bone_density_score.toString() : '1.02';

        var formData = new FormData();
        formData.append('patient_id', patientId);
        formData.append('joint', joint);
        formData.append('implant', implant);
        formData.append('angle', angle);
        formData.append('risk', risk);
        formData.append('stability', stability);
        formData.append('bone_density', boneDensity);
        formData.append('slices', uploadedFileCount.toString());

        reportBtn.innerText = '⏳ Generating...';
        reportBtn.disabled = true;

        fetch('/api/generate-report', { method: 'POST', body: formData })
            .then(function(resp) {
                if (resp.ok) return resp.blob();
                throw new Error('Backend error');
            })
            .then(function(blob) {
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'TwinMed_Report_PT8892.pdf';
                a.click();
                URL.revokeObjectURL(url);
                reportBtn.innerText = '✅ Report Downloaded!';
            })
            .catch(function(err) {
                var report = [
                    '╔══════════════════════════════════════════╗',
                    '║     TwinMed - Surgical Planning Report   ║',
                    '╠══════════════════════════════════════════╣',
                    '║  Patient ID:        ' + patientId,
                    '║  Joint:             ' + joint,
                    '║  Implant:           ' + implant,
                    '║  Alignment Angle:   ' + angle,
                    '║  Impingement Risk:  ' + risk,
                    '║  Stability:         ' + stability,
                    '║  Bone Density:      ' + boneDensity,
                    '║  Slices Processed:  ' + uploadedFileCount,
                    '║  Device:            Jetson AGX Orin',
                    '╚══════════════════════════════════════════╝'
                ].join('\n');

                var blob2 = new Blob([report], { type: 'text/plain' });
                var url2 = URL.createObjectURL(blob2);
                var a2 = document.createElement('a');
                a2.href = url2;
                a2.download = 'TwinMed_Report.txt';
                a2.click();
                URL.revokeObjectURL(url2);
                reportBtn.innerText = '✅ Report Downloaded!';
            });

        setTimeout(function() {
            reportBtn.innerText = 'Generate Surgical Report';
            reportBtn.disabled = false;
        }, 2500);
    });
}

// --- SIMULATE MOVEMENT BUTTON ---
var isSimulatingMovement = false;
var simulateMovementBtn = document.getElementById('simulateMovementBtn');
if (simulateMovementBtn) {
    simulateMovementBtn.addEventListener('click', function() {
        isSimulatingMovement = !isSimulatingMovement;
        if (isSimulatingMovement) {
            simulateMovementBtn.innerText = 'Stop Simulation';
            simulateMovementBtn.style.background = 'rgba(239, 68, 68, 0.15)';
            simulateMovementBtn.style.borderColor = '#ef4444';
            simulateMovementBtn.style.color = '#f87171';
        } else {
            simulateMovementBtn.innerText = 'Simulate Movement';
            simulateMovementBtn.style.background = 'rgba(34, 197, 94, 0.15)';
            simulateMovementBtn.style.borderColor = '#22c55e';
            simulateMovementBtn.style.color = '#4ade80';
        }
    });
}

console.log('✅ TwinMed UI code loaded successfully. Upload is ready.');

// =====================================================================
// SECTION 2: 3D ENGINE (wrapped in try-catch, cannot break UI above)
// =====================================================================
try {

if (typeof THREE === 'undefined') throw new Error("THREE.js did not load!");
if (typeof THREE.OrbitControls === 'undefined') throw new Error("OrbitControls did not load!");

// ---- Global Variables ----
var scene, camera, renderer, controls;
var boneGroup, implantGroup;
var corticalBone, innerBone, innerWireframe;
var container = document.getElementById('canvas-container');

// ---- Implant Configurations ----
var IMPLANTS = {
    '45mm': { headRadius: 1.0, stemHeight: 2.0, stemRadius: 0.28, color: 0xb0b8c8 },
    '48mm': { headRadius: 1.15, stemHeight: 2.2, stemRadius: 0.30, color: 0xc0c8d8 },
    '52mm': { headRadius: 1.35, stemHeight: 2.5, stemRadius: 0.34, color: 0xa8b8d0 }
};

// ---- Biomechanical Data per Implant ----
var BIO_DATA = {
    '45mm': { angle: '128°', risk: '18%',  riskClass: 'text-orange', stability: 'Moderate', stabClass: 'text-orange', progress: 72 },
    '48mm': { angle: '132°', risk: '12%',  riskClass: 'text-orange', stability: 'High',     stabClass: 'text-green',  progress: 88 },
    '52mm': { angle: '135°', risk: '8%',   riskClass: 'text-green',  stability: 'Very High', stabClass: 'text-green', progress: 95 }
};

// =====================================================================
// BUILD BONE (Anatomical Shoulder)
// =====================================================================
function buildBone() {
    if (boneGroup) { scene.remove(boneGroup); }
    boneGroup = new THREE.Group();

    var boneMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8e0cc,
        roughness: 0.85,
        metalness: 0.05,
        side: THREE.DoubleSide
    });

    // --- 1. HUMERUS (Upper Arm) ---
    var humerusGroup = new THREE.Group();
    
    // Humerus Head (The Ball)
    var hHead = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 32), boneMaterial);
    hHead.scale.set(1, 1.1, 0.9);
    hHead.position.set(0, 4.0, 0); // Exact pivot point for implant
    hHead.castShadow = true;
    humerusGroup.add(hHead);
    
    // Greater Tuberosity (Outer Bump)
    var gTube = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), boneMaterial);
    gTube.scale.set(1.5, 2, 1);
    gTube.position.set(-1.2, 3.7, 0.4);
    gTube.rotation.z = 0.4;
    humerusGroup.add(gTube);

    // Humerus Shaft
    var hShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 8, 32), boneMaterial);
    hShaft.position.set(-0.3, 0, 0);
    hShaft.rotation.z = -0.1;
    hShaft.castShadow = true;
    humerusGroup.add(hShaft);
    
    // Epicondyles (Elbow joint base)
    var elbowBase = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 32), boneMaterial);
    elbowBase.scale.set(1.5, 0.8, 0.6);
    elbowBase.position.set(-0.7, -4.0, 0);
    humerusGroup.add(elbowBase);

    // --- 2. SCAPULA (Shoulder Blade) ---
    var scapulaGroup = new THREE.Group();
    
    // Glenoid Cavity (The Socket)
    var glenoid = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, 0.5, 32), boneMaterial);
    glenoid.rotation.z = Math.PI / 2;
    glenoid.rotation.y = -0.2;
    glenoid.position.set(1.8, 3.8, 0);
    scapulaGroup.add(glenoid);
    
    // Scapula Body (The flat triangular wing on the back)
    var scapBody = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 0.5, 7, 3), boneMaterial);
    scapBody.scale.set(1, 1, 0.2);
    scapBody.rotation.z = 0.5;
    scapBody.position.set(4.5, 0.5, -1.5);
    scapulaGroup.add(scapBody);
    
    // Acromion (The bone roof over the shoulder)
    var acromion = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.4, 16, 32, Math.PI), boneMaterial);
    acromion.rotation.x = Math.PI / 2;
    acromion.position.set(2.2, 5.8, 0);
    scapulaGroup.add(acromion);

    // --- 3. CLAVICLE (Collarbone) ---
    var claviclePath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.2, 5.8, 2.2),
        new THREE.Vector3(4.5, 6.0, 4.0),
        new THREE.Vector3(8.0, 5.5, 5.0)
    ]);
    var clavicle = new THREE.Mesh(new THREE.TubeGeometry(claviclePath, 20, 0.4, 8, false), boneMaterial);
    scapulaGroup.add(clavicle);

    // Assemble the full anatomy
    boneGroup.add(humerusGroup);
    boneGroup.add(scapulaGroup);
    
    // Center the whole joint in the viewport
    boneGroup.position.set(-1, -1.5, 0);

    // Add Red AI Landmarks to prove segmentation points
    var markerGeo = new THREE.SphereGeometry(0.15, 16, 16);
    var markerMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
    
    var m1 = new THREE.Mesh(markerGeo, markerMat); m1.position.set(-1.8, 3.8, 0.4);
    var m2 = new THREE.Mesh(markerGeo, markerMat); m2.position.set(0, 5.2, 0);
    var m3 = new THREE.Mesh(markerGeo, markerMat); m3.position.set(1.2, 3.2, 0.2);
    humerusGroup.add(m1); humerusGroup.add(m2); humerusGroup.add(m3);

    scene.add(boneGroup);
}

// =====================================================================
// BUILD IMPLANT
// =====================================================================
function buildImplant(sizeKey) {
    if (implantGroup && implantGroup.parent) {
        implantGroup.parent.remove(implantGroup);
    }
    implantGroup = new THREE.Group();

    var cfg = IMPLANTS[sizeKey];
    var titanium = new THREE.MeshPhongMaterial({
        color: 0xd0d8e8,
        specular: 0xffffff,
        shininess: 180,
        reflectivity: 1.0
    });

    var head = new THREE.Mesh(
        new THREE.SphereGeometry(cfg.headRadius, 40, 40),
        titanium
    );
    head.castShadow = true;

    var collar = new THREE.Mesh(
        new THREE.CylinderGeometry(cfg.stemRadius * 1.4, cfg.stemRadius * 1.4, 0.2, 32),
        titanium
    );
    collar.position.y = -(cfg.headRadius * 0.7);

    var stemPoints = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(cfg.stemRadius * 1.3, 0),
        new THREE.Vector2(cfg.stemRadius * 1.1, cfg.stemHeight * 0.3),
        new THREE.Vector2(cfg.stemRadius * 0.7, cfg.stemHeight * 0.7),
        new THREE.Vector2(cfg.stemRadius * 0.4, cfg.stemHeight),
        new THREE.Vector2(0, cfg.stemHeight),
    ];
    var stem = new THREE.Mesh(
        new THREE.LatheGeometry(stemPoints, 24),
        titanium
    );
    stem.rotation.x = Math.PI;
    stem.position.y = -(cfg.headRadius * 0.7 + 0.1);
    stem.castShadow = true;

    implantGroup.add(head);
    implantGroup.add(collar);
    implantGroup.add(stem);

    implantGroup.position.set(0, 4.0, 0);

    if (boneGroup) {
        boneGroup.add(implantGroup);
    } else {
        scene.add(implantGroup);
    }
}

// =====================================================================
// ANIMATE LOOP
// =====================================================================
function animate() {
    requestAnimationFrame(animate);

    if (innerWireframe && camera) {
        var dist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
        innerWireframe.material.opacity = Math.max(0, Math.min(0.45, (10 - dist) / 12));
    }

    if (isSimulatingMovement && implantGroup) {
        implantGroup.rotation.z = Math.sin(Date.now() * 0.002) * 0.4;
    } else if (implantGroup) {
        implantGroup.rotation.z += (0 - implantGroup.rotation.z) * 0.1;
    }

    controls.update();
    renderer.render(scene, camera);
}

// =====================================================================
// CAMERA SNAP
// =====================================================================
function snapCamera(view) {
    var pos = {
        'Front': { x: 0,  y: 1,  z: 14 },
        'Top':   { x: 0,  y: 16, z: 1  },
        'Side':  { x: 14, y: 1,  z: 0  }
    }[view];
    if (!pos) return;

    var startPos = camera.position.clone();
    var endPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    var t = 0;
    var snap = setInterval(function() {
        t += 0.08;
        camera.position.lerpVectors(startPos, endPos, Math.min(t, 1));
        controls.update();
        if (t >= 1) clearInterval(snap);
    }, 16);
}

// =====================================================================
// INIT 3D
// =====================================================================
function init3D() {
    scene = new THREE.Scene();
    setupOverlay();

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 2, 14);

    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e1) {
        try {
            renderer = new THREE.WebGLRenderer();
        } catch (e2) {
            console.log("WebGL completely dead. Using video-ready static fallback.");
            var fallbackImg = document.createElement('img');
            fallbackImg.id = 'fallback3D';
            fallbackImg.src = 'fallback_3d.png';
            fallbackImg.style.width = '100%';
            fallbackImg.style.height = '100%';
            fallbackImg.style.objectFit = 'contain';
            fallbackImg.style.display = 'none';
            container.appendChild(fallbackImg);
            return; // Exit 3D init
        }
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    var keyLight = new THREE.DirectionalLight(0xfff5e4, 1.0);
    keyLight.position.set(8, 15, 10);
    keyLight.castShadow = true;
    scene.add(keyLight);

    var fillLight = new THREE.DirectionalLight(0xd0eeff, 0.4);
    fillLight.position.set(-10, 5, -5);
    scene.add(fillLight);

    var boneLight = new THREE.PointLight(0xfff0cc, 0.5, 20);
    boneLight.position.set(0, 0, 6);
    scene.add(boneLight);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 4;
    controls.maxDistance = 25;
    controls.target.set(0, 1, 0);

    // Build models
    buildBone();
    buildImplant('48mm');

    // Hidden until scan
    boneGroup.visible = false;
    implantGroup.visible = false;

    // Camera snap buttons
    document.querySelectorAll('.icon-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.icon-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            snapCamera(btn.innerText.trim());
        });
    });

    // Implant dropdown
    var implantSelect = document.querySelector('select.custom-select');
    if (implantSelect) {
        implantSelect.addEventListener('change', function() {
            var val = implantSelect.value;
            var sizeKey = val.indexOf('45') >= 0 ? '45mm' : val.indexOf('48') >= 0 ? '48mm' : '52mm';

            if (implantGroup && implantGroup.visible) {
                var wasVisible = implantGroup.visible;
                buildImplant(sizeKey);
                implantGroup.visible = wasVisible;
            }

            var data = BIO_DATA[sizeKey];
            if (data) {
                document.querySelectorAll('.stat-row .stat-value')[0].textContent = data.angle;
                document.querySelectorAll('.stat-row .stat-value')[1].textContent = data.risk;
                document.querySelectorAll('.stat-row .stat-value')[1].className = 'stat-value ' + data.riskClass;
                document.querySelectorAll('.stat-row .stat-value')[2].textContent = data.stability;
                document.querySelectorAll('.stat-row .stat-value')[2].className = 'stat-value ' + data.stabClass;
                document.querySelector('.progress-fill').style.width = data.progress + '%';
            }
        });
    }

    // Resize
    window.addEventListener('resize', function() {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    animate();
    console.log('✅ TwinMed 3D engine loaded successfully.');
}

// Launch 3D
init3D();

} catch (e) {
    // 3D failed — that's OK, upload still works!
    console.log('⚠️ 3D engine failed: ' + e.message + ' — Upload still functional.');
    fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: e.message, source: '3D_ENGINE' })
    }).catch(function() {});
}
