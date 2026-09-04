/**
 * Vehicle Physics Engine
 * Handles engine RPM, 7-speed automatic transmission, throttle response,
 * aerodynamic drag, braking dynamics, odometer, and G-force calculations.
 */

class VehiclePhysics {
    constructor() {
        // State variables
        this.speed = 0;             // Current speed in km/h
        this.rpm = 850;             // Engine RPM
        this.targetRpm = 850;
        this.idleRpm = 850;
        this.redlineRpm = 7500;
        this.maxRpm = 8200;
        this.gear = 1;              // 1 to 7
        this.gearMode = 'D';        // 'P', 'R', 'N', 'D'
        this.isShifting = false;
        this.shiftTimer = 0;
        this.revLimiterActive = false;
        
        // Input states (0.0 to 1.0)
        this.throttle = 0;          // Raw input
        this.effectiveThrottle = 0; // Smoothed fly-by-wire throttle
        this.brake = 0;             // 0.0 to 1.0
        this.cruiseControl = false;
        this.cruiseSpeed = 0;
        
        // Performance metrics
        this.odometer = 12450.0;    // Total km
        this.tripMeter = 0.0;       // Trip km
        this.maxSpeed = 0;          // Record top speed
        this.gForce = 0;            // Longitudinal G-force
        this.prevSpeed = 0;
        
        // Drive mode configurations
        this.driveModes = {
            eco: {
                name: 'ECO',
                powerMult: 0.72,
                throttleResponse: 2.5,
                shiftUpRpm: 3400,
                shiftDownRpm: 1500,
                topSpeed: 190,
                accentColor: '#10b981'
            },
            comfort: {
                name: 'COMFORT',
                powerMult: 1.0,
                throttleResponse: 3.8,
                shiftUpRpm: 4600,
                shiftDownRpm: 1800,
                topSpeed: 245,
                accentColor: '#3b82f6'
            },
            sport: {
                name: 'SPORT',
                powerMult: 1.35,
                throttleResponse: 6.0,
                shiftUpRpm: 6800,
                shiftDownRpm: 2600,
                topSpeed: 285,
                accentColor: '#f59e0b'
            },
            track: {
                name: 'TRACK',
                powerMult: 1.75,
                throttleResponse: 9.0,
                shiftUpRpm: 7400,
                shiftDownRpm: 3200,
                topSpeed: 320,
                accentColor: '#ef4444'
            }
        };
        
        this.currentModeKey = 'sport';
        
        // Gear speed mapping (km/h per 1000 RPM in each gear)
        this.gearRatios = [
            7.5,   // 1st gear: 7500 RPM ≈ 56 km/h
            13.2,  // 2nd gear: 7500 RPM ≈ 99 km/h
            19.8,  // 3rd gear: 7500 RPM ≈ 148 km/h
            27.5,  // 4th gear: 7500 RPM ≈ 206 km/h
            35.0,  // 5th gear: 7500 RPM ≈ 262 km/h
            42.0,  // 6th gear: 7500 RPM ≈ 315 km/h
            48.5   // 7th gear: cruising overdrive
        ];
    }
    
    setDriveMode(modeKey) {
        if (this.driveModes[modeKey]) {
            this.currentModeKey = modeKey;
        }
    }
    
    getDriveMode() {
        return this.driveModes[this.currentModeKey];
    }
    
    toggleCruiseControl() {
        if (this.speed > 25 && this.gearMode === 'D') {
            this.cruiseControl = !this.cruiseControl;
            if (this.cruiseControl) {
                this.cruiseSpeed = Math.round(this.speed);
            }
        } else {
            this.cruiseControl = false;
        }
        return this.cruiseControl;
    }
    
    resetTrip() {
        this.tripMeter = 0.0;
        this.maxSpeed = 0.0;
    }
    
    update(dt) {
        const mode = this.getDriveMode();
        
        // Cruise control adjustment
        if (this.cruiseControl) {
            if (this.brake > 0.05 || this.gearMode !== 'D') {
                this.cruiseControl = false;
            } else if (this.throttle > 0.1) {
                // Throttle override without canceling cruise
            } else {
                // Auto throttle towards cruise speed
                const speedDiff = this.cruiseSpeed - this.speed;
                if (speedDiff > 0.5) {
                    this.throttle = Math.min(1.0, speedDiff * 0.12);
                } else if (speedDiff < -1.5) {
                    this.throttle = 0;
                    this.brake = Math.min(0.3, Math.abs(speedDiff) * 0.08);
                } else {
                    this.throttle = 0.15; // Maintain speed throttle
                }
            }
        }
        
        // Fly-by-wire throttle response smoothing
        const throttleDelta = this.throttle - this.effectiveThrottle;
        this.effectiveThrottle += throttleDelta * Math.min(1.0, dt * mode.throttleResponse);
        
        // Handle shifting delay
        if (this.isShifting) {
            this.shiftTimer -= dt;
            if (this.shiftTimer <= 0) {
                this.isShifting = false;
            }
        }
        
        // Neutral or Park revving behavior
        if (this.gearMode === 'N' || this.gearMode === 'P') {
            const target = this.idleRpm + this.effectiveThrottle * (this.maxRpm - this.idleRpm);
            if (target > this.redlineRpm) {
                // Rev limiter bouncing
                if (Math.random() > 0.3) {
                    this.rpm = this.redlineRpm + (Math.random() * 250 - 120);
                    this.revLimiterActive = true;
                } else {
                    this.rpm = this.redlineRpm - 400;
                    this.revLimiterActive = false;
                }
            } else {
                this.rpm += (target - this.rpm) * Math.min(1.0, dt * 10.0);
                this.revLimiterActive = false;
            }
            
            // Decelerate speed gradually in N
            this.speed = Math.max(0, this.speed - (5.0 + 0.005 * this.speed * this.speed) * dt);
        }
        // Drive mode physics
        else if (this.gearMode === 'D') {
            const currentRatio = this.gearRatios[this.gear - 1];
            
            // Theoretical mechanical RPM based on wheel speed
            const mechanicalRpm = (this.speed / currentRatio) * 1000;
            
            // Automatic Transmission Shift Logic
            if (!this.isShifting) {
                // Upshift check
                if (this.rpm >= mode.shiftUpRpm && this.gear < 7) {
                    this.gear++;
                    this.isShifting = true;
                    this.shiftTimer = 0.14; // Fast dual-clutch shift time
                }
                // Downshift check (kickdown on high throttle or low speed)
                else if ((this.rpm <= mode.shiftDownRpm || (this.effectiveThrottle > 0.85 && this.rpm < 5200)) && this.gear > 1) {
                    const lowerGearRpm = (this.speed / this.gearRatios[this.gear - 2]) * 1000;
                    if (lowerGearRpm < mode.shiftUpRpm - 400) {
                        this.gear--;
                        this.isShifting = true;
                        this.shiftTimer = 0.18; // Downshift throttle blip
                    }
                }
            }
            
            // RPM calculation with torque converter slip at low speeds
            if (this.isShifting) {
                // Clutch disengaged momentarily
                this.rpm += (this.idleRpm + this.effectiveThrottle * 3000 - this.rpm) * dt * 8;
            } else {
                const clutchSlipMinRpm = this.idleRpm + this.effectiveThrottle * 1600;
                this.rpm = Math.max(mechanicalRpm, clutchSlipMinRpm);
                
                // Redline limiter check in top gear or hard acceleration
                if (this.rpm >= this.redlineRpm) {
                    if (Math.random() > 0.35) {
                        this.rpm = this.redlineRpm + (Math.random() * 150 - 50);
                        this.revLimiterActive = true;
                    } else {
                        this.rpm = this.redlineRpm - 300;
                        this.revLimiterActive = false;
                    }
                } else {
                    this.revLimiterActive = false;
                }
            }
            
            // Acceleration force
            // Torque curve factor peaking around 4500 RPM
            const rpmNorm = (this.rpm - 1000) / 6000;
            const torqueFactor = Math.max(0.4, Math.sin(Math.min(Math.PI, Math.max(0, rpmNorm * Math.PI))));
            
            // Power output based on gear ratio and mode
            const gearTractionFactor = Math.max(0.35, 1.0 - (this.gear - 1) * 0.09);
            const driveForce = this.revLimiterActive ? 0 : 
                this.effectiveThrottle * 58.0 * mode.powerMult * torqueFactor * gearTractionFactor;
            
            // Aerodynamic drag force: proportional to speed squared
            const dragForce = 0.00062 * this.speed * this.speed;
            
            // Rolling resistance force
            const rollingResistance = this.speed > 0.1 ? 1.8 : 0;
            
            // Engine compression braking when off throttle
            const engineBrakeForce = (1.0 - this.effectiveThrottle) * (2.8 + (this.rpm / 1000) * 0.9);
            
            // Mechanical foot brake force
            const brakeForce = this.brake * 72.0;
            
            // Net acceleration (km/h per second)
            const netAcceleration = driveForce - dragForce - rollingResistance - engineBrakeForce - brakeForce;
            
            // Update speed
            this.speed += netAcceleration * dt;
            
            // Top speed cap per drive mode
            if (this.speed > mode.topSpeed) {
                this.speed = mode.topSpeed;
            }
            if (this.speed < 0) {
                this.speed = 0;
            }
        }
        // Reverse mode
        else if (this.gearMode === 'R') {
            const revRatio = 7.0;
            const targetSpeed = this.effectiveThrottle * 45;
            this.speed = Math.max(0, Math.min(targetSpeed, this.speed + (this.effectiveThrottle * 20 - this.brake * 50 - 2.0) * dt));
            this.rpm = Math.max(this.idleRpm, this.idleRpm + (this.speed / revRatio) * 600 + this.effectiveThrottle * 1000);
        }
        
        // Calculate Longitudinal G-force
        const speedMps = (this.speed * 1000) / 3600;
        const prevSpeedMps = (this.prevSpeed * 1000) / 3600;
        const instantG = (speedMps - prevSpeedMps) / (Math.max(0.001, dt) * 9.81);
        this.gForce += (instantG - this.gForce) * Math.min(1.0, dt * 6.0); // smooth G-meter
        this.prevSpeed = this.speed;
        
        // Update top speed record
        if (this.speed > this.maxSpeed) {
            this.maxSpeed = this.speed;
        }
        
        // Update distance / odometer
        const distanceDeltaKm = (this.speed * dt) / 3600;
        this.odometer += distanceDeltaKm;
        this.tripMeter += distanceDeltaKm;
    }
}

// Export for module or global browser context
if (typeof window !== 'undefined') {
    window.VehiclePhysics = VehiclePhysics;
}
