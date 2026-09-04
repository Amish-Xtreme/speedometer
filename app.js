/**
 * Main Application Orchestrator
 * Connects vehicle physics, canvas gauge cluster, sound engine,
 * and user interactions (pedals, keyboard, sliders, modes).
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Components
    const canvas = document.getElementById('gaugeCanvas');
    const physics = new VehiclePhysics();
    const soundEngine = new SoundEngine();
    const gaugeCluster = new GaugeCluster(canvas);

    // 2. DOM Elements
    const gasPedal = document.getElementById('gasPedal');
    const brakePedal = document.getElementById('brakePedal');
    const throttleSlider = document.getElementById('throttleSlider');
    const throttleValDisplay = document.getElementById('throttleVal');
    const soundBtn = document.getElementById('soundBtn');
    const soundLabel = document.getElementById('soundLabel');
    const cruiseBtn = document.getElementById('cruiseBtn');
    const resetTripBtn = document.getElementById('resetTripBtn');

    // Button groups
    const driveModeButtons = document.querySelectorAll('#driveModeGroup .select-btn');
    const unitButtons = document.querySelectorAll('#unitGroup .select-btn');
    const themeButtons = document.querySelectorAll('#themeGroup .select-btn');
    const gearButtons = document.querySelectorAll('.gear-btn');

    // Input States
    let isPedalGasActive = false;
    let isKeyGasActive = false;
    let isPedalBrakeActive = false;
    let isKeyBrakeActive = false;
    let sliderThrottle = 0;

    // Helper: unlock audio on first interaction
    const unlockAudio = () => {
        if (!soundEngine.ctx) {
            soundEngine.initAudio();
        }
    };

    // Helper: refresh throttle based on inputs
    const refreshThrottle = () => {
        if (isPedalGasActive || isKeyGasActive) {
            physics.throttle = 1.0;
        } else {
            physics.throttle = sliderThrottle;
        }
    };

    // Helper: refresh brake based on inputs
    const refreshBrake = () => {
        if (isPedalBrakeActive || isKeyBrakeActive) {
            physics.brake = 1.0;
            if (physics.cruiseControl) {
                physics.cruiseControl = false;
                updateCruiseButtonUI();
            }
        } else {
            physics.brake = 0.0;
        }
    };

    // ==========================================
    // Accelerator (Gas) Pedal Handlers
    // ==========================================
    const startGas = (e) => {
        if (e) e.preventDefault();
        unlockAudio();
        isPedalGasActive = true;
        gasPedal.classList.add('pressed');
        refreshThrottle();
    };

    const stopGas = (e) => {
        if (e) e.preventDefault();
        isPedalGasActive = false;
        gasPedal.classList.remove('pressed');
        refreshThrottle();
    };

    // ==========================================
    // Brake Pedal Handlers
    // ==========================================
    const startBrake = (e) => {
        if (e) e.preventDefault();
        unlockAudio();
        isPedalBrakeActive = true;
        brakePedal.classList.add('pressed');
        refreshBrake();
    };

    const stopBrake = (e) => {
        if (e) e.preventDefault();
        isPedalBrakeActive = false;
        brakePedal.classList.remove('pressed');
        refreshBrake();
    };

    // Attach Pedal Listeners
    gasPedal.addEventListener('mousedown', startGas);
    gasPedal.addEventListener('touchstart', startGas, { passive: false });
    gasPedal.addEventListener('touchend', stopGas, { passive: false });
    gasPedal.addEventListener('touchcancel', stopGas, { passive: false });

    brakePedal.addEventListener('mousedown', startBrake);
    brakePedal.addEventListener('touchstart', startBrake, { passive: false });
    brakePedal.addEventListener('touchend', stopBrake, { passive: false });
    brakePedal.addEventListener('touchcancel', stopBrake, { passive: false });

    // Global mouse up to ensure pedals release even if cursor leaves the pedal
    window.addEventListener('mouseup', () => {
        if (isPedalGasActive) stopGas();
        if (isPedalBrakeActive) stopBrake();
    });

    // ==========================================
    // Continuous Throttle Slider
    // ==========================================
    throttleSlider.addEventListener('input', (e) => {
        unlockAudio();
        sliderThrottle = parseFloat(e.target.value) / 100;
        throttleValDisplay.textContent = `${Math.round(sliderThrottle * 100)}%`;
        refreshThrottle();
    });

    // ==========================================
    // Keyboard Controls
    // ==========================================
    window.addEventListener('keydown', (e) => {
        if (e.repeat && (e.code === 'KeyC' || e.code === 'KeyM')) return;

        switch (e.code) {
            case 'Space':
            case 'ArrowUp':
            case 'KeyW':
                e.preventDefault();
                unlockAudio();
                isKeyGasActive = true;
                gasPedal.classList.add('pressed');
                refreshThrottle();
                break;

            case 'ArrowDown':
            case 'KeyS':
                e.preventDefault();
                unlockAudio();
                isKeyBrakeActive = true;
                brakePedal.classList.add('pressed');
                refreshBrake();
                break;

            case 'KeyC':
                e.preventDefault();
                toggleCruise();
                break;

            case 'KeyM':
                e.preventDefault();
                toggleSound();
                break;

            case 'KeyP':
                setTransmission('P');
                break;
            case 'KeyR':
                setTransmission('R');
                break;
            case 'KeyN':
                setTransmission('N');
                break;
            case 'KeyD':
                setTransmission('D');
                break;

            case 'Digit1':
                setDriveMode('eco');
                break;
            case 'Digit2':
                setDriveMode('comfort');
                break;
            case 'Digit3':
                setDriveMode('sport');
                break;
            case 'Digit4':
                setDriveMode('track');
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'Space':
            case 'ArrowUp':
            case 'KeyW':
                e.preventDefault();
                isKeyGasActive = false;
                if (!isPedalGasActive) {
                    gasPedal.classList.remove('pressed');
                }
                refreshThrottle();
                break;

            case 'ArrowDown':
            case 'KeyS':
                e.preventDefault();
                isKeyBrakeActive = false;
                if (!isPedalBrakeActive) {
                    brakePedal.classList.remove('pressed');
                }
                refreshBrake();
                break;
        }
    });

    // ==========================================
    // Transmission Controls
    // ==========================================
    const setTransmission = (gearMode) => {
        physics.gearMode = gearMode;
        if (gearMode !== 'D' && physics.cruiseControl) {
            physics.cruiseControl = false;
            updateCruiseButtonUI();
        }
        gearButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-gear') === gearMode);
        });
    };

    gearButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const gear = btn.getAttribute('data-gear');
            setTransmission(gear);
        });
    });

    // ==========================================
    // Drive Mode Controls
    // ==========================================
    const setDriveMode = (modeKey) => {
        physics.setDriveMode(modeKey);
        driveModeButtons.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-mode') === modeKey);
        });
    };

    driveModeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            setDriveMode(mode);
        });
    });

    // ==========================================
    // Units Selector (KM/H vs MPH)
    // ==========================================
    unitButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const unit = btn.getAttribute('data-unit');
            gaugeCluster.setUnit(unit);
            unitButtons.forEach(b => b.classList.toggle('active', b === btn));
        });
    });

    // ==========================================
    // Theme Selector
    // ==========================================
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            gaugeCluster.setTheme(theme);
            themeButtons.forEach(b => b.classList.toggle('active', b === btn));
        });
    });

    // ==========================================
    // Cruise Control & Trip Reset
    // ==========================================
    const updateCruiseButtonUI = () => {
        cruiseBtn.classList.toggle('active', physics.cruiseControl);
    };

    const toggleCruise = () => {
        const isActive = physics.toggleCruiseControl();
        updateCruiseButtonUI();
    };

    cruiseBtn.addEventListener('click', toggleCruise);

    resetTripBtn.addEventListener('click', () => {
        physics.resetTrip();
    });

    // ==========================================
    // Sound FX Toggle
    // ==========================================
    const toggleSound = () => {
        const isEnabled = soundEngine.toggle();
        soundBtn.classList.toggle('active', isEnabled);
        soundLabel.textContent = isEnabled ? 'Sound: ON' : 'Sound: OFF';
    };

    soundBtn.addEventListener('click', toggleSound);

    // ==========================================
    // Main 60fps Physics & Render Loop
    // ==========================================
    let lastTime = performance.now();

    const loop = (currentTime) => {
        const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
        lastTime = currentTime;

        // 1. Update Physics
        physics.update(dt);

        // 2. Update Sound Synthesizer
        soundEngine.update(physics);

        // 3. Render Gauge Cluster
        gaugeCluster.render(physics);

        // 4. Sync UI states
        updateCruiseButtonUI();

        // Keep looping
        requestAnimationFrame(loop);
    };

    // Kick off animation loop
    requestAnimationFrame(loop);
});
