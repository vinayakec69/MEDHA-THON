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
// BUILD BONE (Anatomical Shoulder - Kenhub Reference)
// =====================================================================

// Helper: Add organic noise to mesh vertices for bone-like surface
function perturbVertices(geometry, amount) {
    var pos = geometry.attributes.position;
    for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        var len = Math.sqrt(x*x + y*y + z*z);
        if (len < 0.01) continue;
        var noise = (Math.sin(x*12.9898 + y*78.233) * 43758.5453) % 1;
        noise = noise * 2 - 1;
        var factor = 1 + noise * amount;
        pos.setXYZ(i, x * factor, y + noise * amount * 0.3, z * factor);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
}

// Helper: Create smooth LatheGeometry from profile
function createBoneLathe(points, segments) {
    var curve = new THREE.SplineCurve(points);
    var smoothed = curve.getPoints(80);
    smoothed[0].x = Math.max(0.001, smoothed[0].x);
    return new THREE.LatheGeometry(smoothed, segments || 48);
}

function buildBone() {
    if (boneGroup) { scene.remove(boneGroup); }
    boneGroup = new THREE.Group();

    // --- MATERIALS ---
    var corticalMat = new THREE.MeshStandardMaterial({
        color: 0xc8b89a, roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide
    });
    var scapulaMat = new THREE.MeshStandardMaterial({
        color: 0xb5a68e, roughness: 0.90, metalness: 0.02, side: THREE.DoubleSide
    });
    var jointCapsuleMat = new THREE.MeshStandardMaterial({
        color: 0x2ecc71, roughness: 0.45, metalness: 0.15, side: THREE.DoubleSide
    });
    var cartilageMat = new THREE.MeshStandardMaterial({
        color: 0xe8eef5, roughness: 0.35, metalness: 0.08, side: THREE.DoubleSide
    });
    var cancMat = new THREE.MeshStandardMaterial({
        color: 0xc4a66a, roughness: 1.0, metalness: 0.0,
        transparent: true, opacity: 0.4, side: THREE.DoubleSide
    });

    // =================================================================
    // 1. HUMERUS (Upper Arm Bone)
    // =================================================================
    var humerusGroup = new THREE.Group();
    humerusGroup.name = "humerusGroup";

    var humerusProfile = [
        new THREE.Vector2(0.01, -6.0),
        new THREE.Vector2(0.35, -5.9),
        new THREE.Vector2(0.55, -5.7),
        new THREE.Vector2(0.70, -5.3),
        new THREE.Vector2(0.62, -4.8),
        new THREE.Vector2(0.50, -4.2),
        new THREE.Vector2(0.44, -3.5),
        new THREE.Vector2(0.40, -2.8),
        new THREE.Vector2(0.38, -2.0),
        new THREE.Vector2(0.37, -1.2),
        new THREE.Vector2(0.38, -0.4),
        new THREE.Vector2(0.40,  0.3),
        new THREE.Vector2(0.44,  1.0),
        new THREE.Vector2(0.50,  1.6),
        new THREE.Vector2(0.60,  2.2),
        new THREE.Vector2(0.75,  2.7),
        new THREE.Vector2(0.95,  3.0),
        // SURGICAL CUT: Resect the anatomical head so implant collar sits flush
        new THREE.Vector2(1.05,  3.2), // Outer cortex of cut
        new THREE.Vector2(0.01,  3.2), // Flat resected top
    ];
    var humerusGeo = createBoneLathe(humerusProfile, 48);
    perturbVertices(humerusGeo, 0.012);
    var humerusMesh = new THREE.Mesh(humerusGeo, corticalMat);
    humerusMesh.castShadow = true;
    humerusGroup.add(humerusMesh);



    // Greater Tuberosity
    var gtGeo = new THREE.SphereGeometry(0.55, 24, 24);
    perturbVertices(gtGeo, 0.035);
    var gtMesh = new THREE.Mesh(gtGeo, corticalMat);
    gtMesh.scale.set(1.3, 1.8, 0.85);
    gtMesh.position.set(1.1, 3.2, 0.2);
    humerusGroup.add(gtMesh);

    // Lesser Tuberosity
    var ltGeo = new THREE.SphereGeometry(0.38, 20, 20);
    perturbVertices(ltGeo, 0.03);
    var ltMesh = new THREE.Mesh(ltGeo, corticalMat);
    ltMesh.scale.set(0.85, 1.2, 1.1);
    ltMesh.position.set(-0.35, 3.4, 0.7);
    humerusGroup.add(ltMesh);

    // Deltoid Tuberosity ridge
    var deltPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.42, 1.8, 0),
        new THREE.Vector3(0.52, 1.0, 0.15),
        new THREE.Vector3(0.48, 0.2, 0.1),
        new THREE.Vector3(0.42, -0.5, 0),
    ]);
    var deltGeo = new THREE.TubeGeometry(deltPath, 12, 0.06, 6, false);
    perturbVertices(deltGeo, 0.04);
    humerusGroup.add(new THREE.Mesh(deltGeo, corticalMat));

    // Epicondyles
    var medEpi = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), corticalMat);
    perturbVertices(medEpi.geometry, 0.04);
    medEpi.scale.set(1.4, 0.7, 0.9);
    medEpi.position.set(-0.48, -5.6, 0);
    humerusGroup.add(medEpi);
    var latEpi = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), corticalMat);
    perturbVertices(latEpi.geometry, 0.04);
    latEpi.scale.set(1.3, 0.6, 0.8);
    latEpi.position.set(0.48, -5.6, 0);
    humerusGroup.add(latEpi);

    // Inner cancellous
    var innerProfile = humerusProfile.map(function(p) {
        return new THREE.Vector2(p.x * 0.50, p.y * 0.97);
    });
    var innerGeo = createBoneLathe(innerProfile, 20);
    humerusGroup.add(new THREE.Mesh(innerGeo, cancMat));

    // Trabecular wireframe
    var wireGeo = createBoneLathe(innerProfile, 8);
    innerWireframe = new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({
        color: 0xa07030, wireframe: true, transparent: true, opacity: 0.0
    }));
    humerusGroup.add(innerWireframe);

    // Angle humerus down-left, positioned so the head sits snugly in the glenoid
    humerusGroup.rotation.z = 0.18;
    humerusGroup.position.set(1.3, -0.3, 0);

    // =================================================================
    // 2. GLENOHUMERAL JOINT (Green like Kenhub reference)
    // =================================================================
    var jointGroup = new THREE.Group();

    // Labrum ring (green ring - subtle, matching Kenhub)
    var labrumGeo = new THREE.TorusGeometry(1.1, 0.15, 16, 32);
    perturbVertices(labrumGeo, 0.02);
    var labrumMesh = new THREE.Mesh(labrumGeo, jointCapsuleMat);
    labrumMesh.position.set(0.4, 3.5, 0);
    labrumMesh.rotation.y = Math.PI / 2 + 0.15;
    jointGroup.add(labrumMesh);

    // Joint capsule sleeve (subtle wrap around the joint)
    var capsuleMat2 = new THREE.MeshStandardMaterial({
        color: 0x27ae60, roughness: 0.5, metalness: 0.1,
        transparent: true, opacity: 0.35, side: THREE.DoubleSide
    });
    var capsuleGeo = new THREE.CylinderGeometry(1.3, 1.1, 1.2, 24, 1, true);
    perturbVertices(capsuleGeo, 0.02);
    var capsuleMesh = new THREE.Mesh(capsuleGeo, capsuleMat2);
    capsuleMesh.position.set(0.1, 3.5, 0);
    capsuleMesh.rotation.z = 0.12;
    jointGroup.add(capsuleMesh);

    // =================================================================
    // 3. SCAPULA (Large triangular blade like reference)
    // =================================================================
    var scapulaGroup = new THREE.Group();

    // Glenoid Fossa
    var glenoidProfile = [
        new THREE.Vector2(0.01, -0.4),
        new THREE.Vector2(0.5,  -0.35),
        new THREE.Vector2(0.9,  -0.25),
        new THREE.Vector2(1.2,  -0.1),
        new THREE.Vector2(1.3,   0.0),
        new THREE.Vector2(1.2,   0.1),
        new THREE.Vector2(0.9,   0.2),
        new THREE.Vector2(0.5,   0.3),
        new THREE.Vector2(0.01,  0.35),
    ];
    var glenoidGeo = createBoneLathe(glenoidProfile, 32);
    perturbVertices(glenoidGeo, 0.015);
    var glenoidMesh = new THREE.Mesh(glenoidGeo, corticalMat);
    glenoidMesh.rotation.z = Math.PI / 2;
    glenoidMesh.position.set(0.8, 3.5, 0);
    scapulaGroup.add(glenoidMesh);

    // Scapular Neck
    var neckPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.0, 3.5, 0),
        new THREE.Vector3(1.8, 3.0, -0.2),
        new THREE.Vector3(2.5, 2.3, -0.4),
        new THREE.Vector3(3.2, 1.5, -0.5),
    ]);
    var neckGeo = new THREE.TubeGeometry(neckPath, 16, 0.55, 12, false);
    perturbVertices(neckGeo, 0.02);
    scapulaGroup.add(new THREE.Mesh(neckGeo, scapulaMat));

    // SCAPULA BODY (Large flat triangular blade)
    var scapShape = new THREE.Shape();
    scapShape.moveTo(3.0, 2.0);
    scapShape.bezierCurveTo(4.0, 2.5, 5.5, 2.8, 7.0, 2.5);
    scapShape.bezierCurveTo(7.5, 2.2, 7.8, 1.5, 7.8, 0.5);
    scapShape.bezierCurveTo(7.9, -0.5, 7.8, -2.0, 7.5, -3.5);
    scapShape.bezierCurveTo(7.2, -5.0, 6.8, -6.0, 6.0, -7.0);
    scapShape.bezierCurveTo(5.5, -7.5, 5.0, -7.8, 4.5, -7.5);
    scapShape.bezierCurveTo(4.0, -7.0, 3.5, -5.5, 3.2, -4.0);
    scapShape.bezierCurveTo(2.8, -2.5, 2.6, -1.0, 2.6, 0.0);
    scapShape.bezierCurveTo(2.7, 0.8, 2.8, 1.5, 3.0, 2.0);
    var extrudeSettings = {
        depth: 0.20, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2
    };
    var scapGeo = new THREE.ExtrudeGeometry(scapShape, extrudeSettings);
    perturbVertices(scapGeo, 0.015);
    var scapMesh = new THREE.Mesh(scapGeo, scapulaMat);
    scapMesh.position.z = -0.6;
    scapMesh.castShadow = true;
    scapulaGroup.add(scapMesh);

    // Scapular Spine (ridge across posterior)
    var spinePath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(3.0, 0.8, -0.3),
        new THREE.Vector3(4.0, 1.5, -0.1),
        new THREE.Vector3(5.0, 2.2, 0.0),
        new THREE.Vector3(6.0, 2.6, 0.1),
        new THREE.Vector3(7.0, 2.5, 0.15),
    ]);
    var spineGeo = new THREE.TubeGeometry(spinePath, 20, 0.3, 10, false);
    perturbVertices(spineGeo, 0.025);
    scapulaGroup.add(new THREE.Mesh(spineGeo, scapulaMat));

    // Acromion Process (curves over the joint)
    var acromPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(3.0, 0.8, -0.3),
        new THREE.Vector3(2.2, 2.5, 0.0),
        new THREE.Vector3(1.5, 3.8, 0.3),
        new THREE.Vector3(0.5, 4.8, 0.5),
        new THREE.Vector3(-0.3, 5.2, 0.4),
    ]);
    var acromGeo = new THREE.TubeGeometry(acromPath, 24, 0.38, 10, false);
    perturbVertices(acromGeo, 0.02);
    scapulaGroup.add(new THREE.Mesh(acromGeo, corticalMat));

    // Acromion flat top
    var acromPlateGeo = new THREE.BoxGeometry(1.8, 0.12, 1.0);
    perturbVertices(acromPlateGeo, 0.03);
    var acromPlate = new THREE.Mesh(acromPlateGeo, corticalMat);
    acromPlate.position.set(-0.1, 5.3, 0.4);
    acromPlate.rotation.z = 0.2;
    scapulaGroup.add(acromPlate);

    // Coracoid Process (hook going forward)
    var coracPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.5, 3.5, 0.2),
        new THREE.Vector3(1.0, 4.2, 0.8),
        new THREE.Vector3(0.2, 4.6, 1.5),
        new THREE.Vector3(-0.5, 4.3, 1.8),
        new THREE.Vector3(-0.8, 3.8, 1.6),
    ]);
    var coracGeo = new THREE.TubeGeometry(coracPath, 20, 0.22, 8, false);
    perturbVertices(coracGeo, 0.025);
    scapulaGroup.add(new THREE.Mesh(coracGeo, corticalMat));
    var coracTip = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), corticalMat);
    perturbVertices(coracTip.geometry, 0.04);
    coracTip.position.set(-0.8, 3.8, 1.6);
    scapulaGroup.add(coracTip);

    // =================================================================
    // 4. CLAVICLE (S-curved collarbone)
    // =================================================================
    var clavPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.3, 5.2, 0.4),
        new THREE.Vector3(1.5, 5.6, 1.5),
        new THREE.Vector3(3.5, 5.9, 2.5),
        new THREE.Vector3(5.0, 5.7, 3.5),
        new THREE.Vector3(6.5, 5.3, 4.0),
    ]);
    var clavGeo = new THREE.TubeGeometry(clavPath, 24, 0.35, 10, false);
    perturbVertices(clavGeo, 0.018);
    scapulaGroup.add(new THREE.Mesh(clavGeo, corticalMat));

    // Sternal end
    var sternalEnd = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), corticalMat);
    perturbVertices(sternalEnd.geometry, 0.03);
    sternalEnd.scale.set(1.0, 0.6, 1.2);
    sternalEnd.position.set(6.5, 5.3, 4.0);
    scapulaGroup.add(sternalEnd);

    // AC Joint
    var acjMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), corticalMat);
    perturbVertices(acjMesh.geometry, 0.03);
    acjMesh.position.set(-0.3, 5.2, 0.4);
    scapulaGroup.add(acjMesh);

    // =================================================================
    // 5. VASCULAR SYSTEM (Arteries & Veins)
    // =================================================================
    var vascularGroup = new THREE.Group();
    vascularGroup.name = "vascularSystem";
    vascularGroup.visible = false; // Hidden by default
    
    var arteryMat = new THREE.MeshPhongMaterial({ color: 0xff3333, shininess: 40 });
    var veinMat = new THREE.MeshPhongMaterial({ color: 0x3366ff, shininess: 40 });

    // 1. Subclavian to Axillary Artery (Main descending supply - brought forward and down)
    var axillaryPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(5.0, 4.5, 4.5), // Lowered and brought forward to clear clavicle
        new THREE.Vector3(2.0, 3.0, 3.0), // Under clavicle
        new THREE.Vector3(-0.2, 1.5, 2.2), // Past glenoid, well in front
        new THREE.Vector3(0.5, -1.0, 1.8), // Down medial humerus
        new THREE.Vector3(0.8, -5.0, 1.5),
        new THREE.Vector3(1.0, -8.0, 1.3)
    ]);
    vascularGroup.add(new THREE.Mesh(new THREE.TubeGeometry(axillaryPath, 64, 0.18, 8, false), arteryMat));

    // 2. Anterior Circumflex Humeral Artery (Wraps front of surgical neck closely)
    var antCircumflexPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.1, 1.5, 2.2),  // Branches from Axillary
        new THREE.Vector3(-0.8, 1.5, 2.2),  // Front of humerus (pushed forward)
        new THREE.Vector3(-1.8, 1.4, 1.5),
        new THREE.Vector3(-2.2, 1.3, 0.5)
    ]);
    vascularGroup.add(new THREE.Mesh(new THREE.TubeGeometry(antCircumflexPath, 32, 0.08, 8, false), arteryMat));

    // 3. Posterior Circumflex Humeral Artery (Wraps back of surgical neck)
    var postCircumflexPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.1, 1.5, 2.2),  // Branches from Axillary
        new THREE.Vector3(0.5, 1.6, -0.5),  // Pushed further back behind humerus
        new THREE.Vector3(-1.0, 1.4, -1.5),
        new THREE.Vector3(-2.2, 1.3, -0.5),
        new THREE.Vector3(-2.2, 1.3, 0.5)   // Anastomoses with Anterior
    ]);
    vascularGroup.add(new THREE.Mesh(new THREE.TubeGeometry(postCircumflexPath, 40, 0.1, 8, false), arteryMat));

    // 4. Suprascapular Artery (Over the scapula, raised higher)
    var supraPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(3.0, 5.5, 3.0), // Raised above clavicle
        new THREE.Vector3(1.0, 5.8, 1.0),
        new THREE.Vector3(-0.5, 5.5, -1.0),
        new THREE.Vector3(-1.5, 4.0, -1.5)
    ]);
    vascularGroup.add(new THREE.Mesh(new THREE.TubeGeometry(supraPath, 40, 0.09, 8, false), arteryMat));

    // 5. Axillary Vein (Runs parallel to Axillary Artery, slightly more medial/forward)
    var axillaryVeinPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(4.8, 4.2, 4.8),
        new THREE.Vector3(1.8, 2.8, 3.3),
        new THREE.Vector3(-0.4, 1.3, 2.5),
        new THREE.Vector3(0.3, -1.2, 2.1),
        new THREE.Vector3(0.6, -5.2, 1.8),
        new THREE.Vector3(0.8, -8.2, 1.6)
    ]);
    vascularGroup.add(new THREE.Mesh(new THREE.TubeGeometry(axillaryVeinPath, 64, 0.22, 8, false), veinMat));

    // 6. Cephalic Vein (Superficial lateral vein, pushed out to avoid humerus intersection)
    var cephalicPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.5, 4.8, 4.2),
        new THREE.Vector3(0.5, 4.0, 3.8),
        new THREE.Vector3(-2.0, 2.5, 3.0),
        new THREE.Vector3(-2.5, 0.0, 2.2),
        new THREE.Vector3(-2.2, -4.0, 1.8),
        new THREE.Vector3(-1.8, -8.0, 1.5)
    ]);
    vascularGroup.add(new THREE.Mesh(new THREE.TubeGeometry(cephalicPath, 64, 0.15, 8, false), veinMat));

    // =================================================================
    // ASSEMBLE
    // =================================================================
    boneGroup.add(humerusGroup);
    boneGroup.add(jointGroup);
    boneGroup.add(scapulaGroup);
    boneGroup.add(vascularGroup);
    boneGroup.position.set(0, -0.5, 0);

    // AI Segmentation Landmarks
    var markerGeo = new THREE.SphereGeometry(0.10, 16, 16);
    var markerMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
    [[-1.2, 2.5, 0.2], [-1.8, 4.0, 0], [0.8, 3.5, 0], [-0.3, 5.2, 0.4], [-0.8, 3.8, 1.6]].forEach(function(pos) {
        var m = new THREE.Mesh(markerGeo, markerMat);
        m.position.set(pos[0], pos[1], pos[2]);
        boneGroup.add(m);
    });

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
    head.name = 'implant';
    // Center the head so its base rests perfectly on the collar
    head.position.y = -0.8 + (cfg.headRadius * 0.6);
    head.castShadow = true;

    var collar = new THREE.Mesh(
        new THREE.CylinderGeometry(cfg.stemRadius * 1.4, cfg.stemRadius * 1.4, 0.2, 32),
        titanium
    );
    collar.name = 'implant';
    // Fix collar at exactly y = -0.8 relative to implantGroup (which is at y = 4.0).
    // This perfectly aligns it with the flat bone cut at y = 3.2!
    collar.position.y = -0.8; 

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
    stem.name = 'implant';
    stem.rotation.x = Math.PI;
    stem.position.y = -0.9; // Just below the collar
    stem.castShadow = true;

    implantGroup.add(head);
    implantGroup.add(collar);
    implantGroup.add(stem);

    implantGroup.position.set(0, 4.0, 0);

    if (boneGroup) {
        var hGroup = boneGroup.getObjectByName("humerusGroup");
        if (hGroup) {
            hGroup.add(implantGroup);
        } else {
            boneGroup.add(implantGroup);
        }
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
        if (btn.id === 'xrayBtn' || btn.id === 'cutGuideBtn' || btn.id === 'veinBtn') return; // Skip special toggles
        btn.addEventListener('click', function() {
            document.querySelectorAll('.icon-btn:not(#xrayBtn):not(#cutGuideBtn):not(#veinBtn)').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            snapCamera(btn.innerText.trim());
        });
    });

    // Vascular System Toggle
    var veinBtn = document.getElementById('veinBtn');
    var isVein = false;
    if (veinBtn) {
        veinBtn.addEventListener('click', function() {
            isVein = !isVein;
            if (isVein) {
                veinBtn.style.background = '#e74c3c';
                veinBtn.style.color = '#0f172a';
            } else {
                veinBtn.style.background = 'transparent';
                veinBtn.style.color = '#e74c3c';
            }
            
            if (boneGroup) {
                var vascularGroup = boneGroup.getObjectByName("vascularSystem");
                if (vascularGroup) {
                    vascularGroup.visible = isVein;
                }
            }
        });
    }

    // Cutting Guide Toggle
    var cutGuideBtn = document.getElementById('cutGuideBtn');
    var isCutGuide = false;
    var cutPlane = null;
    if (cutGuideBtn) {
        cutGuideBtn.addEventListener('click', function() {
            isCutGuide = !isCutGuide;
            if (isCutGuide) {
                cutGuideBtn.style.background = '#f39c12';
                cutGuideBtn.style.color = '#0f172a';
                
                // Add the resection plane to boneGroup if it doesn't exist
                if (!cutPlane && boneGroup) {
                    var planeGeo = new THREE.PlaneGeometry(5, 5);
                    var planeMat = new THREE.MeshBasicMaterial({ color: 0xf39c12, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
                    cutPlane = new THREE.Mesh(planeGeo, planeMat);
                    
                    // The humerus resection happens around y = 3.2, but the implant group sits at y=4.0
                    // Let's place the plane slightly above the cut to show where the saw would go.
                    cutPlane.rotation.x = Math.PI / 2;
                    cutPlane.position.set(0, 3.2, 0); 
                    
                    // Add grid lines for a more technical look
                    var grid = new THREE.GridHelper(5, 10, 0xffaa00, 0xffaa00);
                    grid.rotation.x = Math.PI / 2;
                    cutPlane.add(grid);
                    
                    boneGroup.add(cutPlane);
                } else if (cutPlane) {
                    cutPlane.visible = true;
                }
            } else {
                cutGuideBtn.style.background = 'transparent';
                cutGuideBtn.style.color = '#f39c12';
                if (cutPlane) cutPlane.visible = false;
            }
        });
    }

    // X-Ray Mode Toggle
    var xrayBtn = document.getElementById('xrayBtn');
    var isXray = false;
    if (xrayBtn) {
        xrayBtn.addEventListener('click', function() {
            isXray = !isXray;
            if (isXray) {
                xrayBtn.style.background = '#00f0ff';
                xrayBtn.style.color = '#0f172a';
            } else {
                xrayBtn.style.background = 'transparent';
                xrayBtn.style.color = '#00f0ff';
            }
            
            if (boneGroup) {
                boneGroup.traverse(function(child) {
                    if (child.isMesh && child.material && child.name !== 'implant') {
                        child.material.transparent = true;
                        child.material.opacity = isXray ? 0.25 : 1.0;
                    }
                });
            }
        });
    }

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
