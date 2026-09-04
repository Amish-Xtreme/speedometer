/**
 * High-Precision Canvas Instrument Cluster Renderer
 * Renders Speedometer, Tachometer (RPM), digital HUD, LED arcs,
 * glowing needles, and dynamic telemetry.
 */

class GaugeCluster {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.unit = 'kmh'; // 'kmh' or 'mph'
        this.theme = 'neon'; // 'neon', 'classic', 'stealth'
        
        // Needle smoothing
        this.smoothSpeed = 0;
        this.smoothRpm = 850;
        
        // Setup Retina scaling
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    setUnit(unit) {
        this.unit = unit;
    }
    
    setTheme(theme) {
        this.theme = theme;
    }
    
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;
        this.width = rect.width;
        // Maintain a 16:9 or 2:1 widescreen automotive cluster aspect ratio
        this.height = Math.min(rect.width * 0.52, 540);
        
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
    }
    
    getThemeColors() {
        if (this.theme === 'classic') {
            return {
                bg: '#0c0f12',
                dialBg: '#151921',
                rimOuter: '#3a4454',
                rimInner: '#1e2430',
                tickMajor: '#ffffff',
                tickMinor: '#718096',
                text: '#e2e8f0',
                accent: '#f59e0b',       // Amber needle
                needleGlow: 'rgba(245, 158, 11, 0.45)',
                redline: '#ef4444',
                hudBg: 'rgba(15, 23, 42, 0.8)',
                arcTrack: '#1e293b'
            };
        } else if (this.theme === 'stealth') {
            return {
                bg: '#050709',
                dialBg: '#0e131a',
                rimOuter: '#27313f',
                rimInner: '#121820',
                tickMajor: '#e2e8f0',
                tickMinor: '#475569',
                text: '#f8fafc',
                accent: '#38bdf8',       // Ice Blue
                needleGlow: 'rgba(56, 189, 248, 0.45)',
                redline: '#f43f5e',
                hudBg: 'rgba(14, 19, 26, 0.85)',
                arcTrack: '#1e293b'
            };
        }
        // Default 'neon'
        return {
            bg: '#05070b',
            dialBg: '#090e17',
            rimOuter: '#00f0ff',
            rimInner: '#0b192c',
            tickMajor: '#e0f2fe',
            tickMinor: '#0284c7',
            text: '#ffffff',
            accent: '#00f0ff',           // Cyber Cyan
            needleGlow: 'rgba(0, 240, 255, 0.65)',
            redline: '#ff0055',
            hudBg: 'rgba(5, 11, 22, 0.85)',
            arcTrack: 'rgba(0, 240, 255, 0.12)'
        };
    }
    
    render(physics) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const colors = this.getThemeColors();
        
        ctx.save();
        ctx.scale(this.dpr, this.dpr);
        
        // Smooth needle movement (spring-like natural lag)
        this.smoothSpeed += (physics.speed - this.smoothSpeed) * 0.22;
        this.smoothRpm += (physics.rpm - this.smoothRpm) * 0.25;
        
        // Clear background
        ctx.clearRect(0, 0, w, h);
        
        // Gauge geometries
        const isMobile = w < 680;
        let rpmCenter, speedCenter, radius;
        
        if (isMobile) {
            // Stacked or single prominent cluster on small mobile screens
            radius = Math.min(w * 0.44, h * 0.65);
            speedCenter = { x: w * 0.5, y: h * 0.58 };
            rpmCenter = { x: w * 0.5, y: h * 0.58 };
        } else {
            radius = Math.min(w * 0.24, h * 0.42);
            rpmCenter = { x: w * 0.27, y: h * 0.54 };
            speedCenter = { x: w * 0.73, y: h * 0.54 };
        }
        
        // Draw Tachometer (Left on desktop)
        if (!isMobile) {
            this.drawTachometer(rpmCenter.x, rpmCenter.y, radius, physics, colors);
        }
        
        // Draw Speedometer (Right on desktop, Center on mobile)
        this.drawSpeedometer(speedCenter.x, speedCenter.y, radius, physics, colors, isMobile);
        
        // Draw Center Telemetry / HUD
        if (!isMobile) {
            this.drawCenterHUD(w * 0.5, h * 0.54, w * 0.18, h * 0.7, physics, colors);
        }
        
        ctx.restore();
    }
    
    drawSpeedometer(cx, cy, r, physics, colors, isMobile) {
        const ctx = this.ctx;
        const isMph = this.unit === 'mph';
        const displaySpeed = isMph ? this.smoothSpeed * 0.621371 : this.smoothSpeed;
        const maxScale = isMph ? 180 : 280;
        
        // Angle range: from 135 deg (bottom-left) to 405 deg (bottom-right), 270 degree span
        const startAngle = Math.PI * 0.75;
        const endAngle = Math.PI * 2.25;
        const angleSpan = endAngle - startAngle;
        
        // Dial Background & Rim
        this.drawDialBase(cx, cy, r, colors);
        
        // Draw illuminated active track
        const currentFrac = Math.min(1.0, Math.max(0, displaySpeed / maxScale));
        const activeAngle = startAngle + currentFrac * angleSpan;
        
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.86, startAngle, activeAngle);
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 6;
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Major & Minor Ticks
        const step = isMph ? 20 : 20;
        const totalSteps = maxScale / step;
        
        ctx.font = `600 ${Math.round(r * 0.11)}px 'Segoe UI', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i <= totalSteps; i++) {
            const val = i * step;
            const frac = val / maxScale;
            const angle = startAngle + frac * angleSpan;
            
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            
            // Major tick mark
            const tickOuter = r * 0.86;
            const tickInner = r * 0.74;
            
            ctx.beginPath();
            ctx.moveTo(cx + cosA * tickInner, cy + sinA * tickInner);
            ctx.lineTo(cx + cosA * tickOuter, cy + sinA * tickOuter);
            ctx.strokeStyle = colors.tickMajor;
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Numbers
            const textR = r * 0.62;
            ctx.fillStyle = colors.text;
            ctx.fillText(val.toString(), cx + cosA * textR, cy + sinA * textR);
            
            // Minor ticks
            if (i < totalSteps) {
                for (let j = 1; j <= 3; j++) {
                    const subFrac = frac + (j / 4) * (1 / totalSteps);
                    const subAngle = startAngle + subFrac * angleSpan;
                    const subCos = Math.cos(subAngle);
                    const subSin = Math.sin(subAngle);
                    
                    ctx.beginPath();
                    ctx.moveTo(cx + subCos * (r * 0.82), cy + subSin * (r * 0.82));
                    ctx.lineTo(cx + subCos * tickOuter, cy + subSin * tickOuter);
                    ctx.strokeStyle = colors.tickMinor;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            }
        }
        
        // Needle
        this.drawNeedle(cx, cy, r * 0.82, activeAngle, colors.accent, colors.needleGlow);
        
        // Center digital speed readout
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Large speed number
        const speedValueText = Math.round(displaySpeed).toString();
        ctx.font = `800 ${Math.round(r * 0.32)}px 'Segoe UI', monospace, sans-serif`;
        ctx.fillStyle = colors.text;
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 8;
        ctx.fillText(speedValueText, cx, cy + r * 0.22);
        ctx.shadowBlur = 0;
        
        // Unit label
        ctx.font = `700 ${Math.round(r * 0.10)}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = colors.accent;
        ctx.fillText(this.unit.toUpperCase(), cx, cy + r * 0.40);
        
        // Cruise control badge if active
        if (physics.cruiseControl) {
            ctx.fillStyle = '#10b981';
            ctx.font = `600 ${Math.round(r * 0.08)}px 'Segoe UI', sans-serif`;
            ctx.fillText(`CRUISE ${Math.round(isMph ? physics.cruiseSpeed * 0.621371 : physics.cruiseSpeed)}`, cx, cy - r * 0.32);
        }
    }
    
    drawTachometer(cx, cy, r, physics, colors) {
        const ctx = this.ctx;
        const rpm = this.smoothRpm;
        const maxRpm = 8000;
        const redlineStart = 6500;
        
        const startAngle = Math.PI * 0.75;
        const endAngle = Math.PI * 2.25;
        const angleSpan = endAngle - startAngle;
        
        this.drawDialBase(cx, cy, r, colors);
        
        // Redline Arc Zone
        const redlineFrac = redlineStart / maxRpm;
        const redlineAngle = startAngle + redlineFrac * angleSpan;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.86, redlineAngle, endAngle);
        ctx.strokeStyle = colors.redline;
        ctx.lineWidth = 6;
        ctx.shadowColor = colors.redline;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Active RPM track
        const currentFrac = Math.min(1.0, Math.max(0, rpm / maxRpm));
        const activeAngle = startAngle + currentFrac * angleSpan;
        
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.86, startAngle, activeAngle);
        ctx.strokeStyle = rpm >= redlineStart ? colors.redline : colors.accent;
        ctx.lineWidth = 6;
        ctx.shadowColor = rpm >= redlineStart ? colors.redline : colors.accent;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Ticks (0 through 8)
        ctx.font = `600 ${Math.round(r * 0.12)}px 'Segoe UI', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i <= 8; i++) {
            const frac = i / 8;
            const angle = startAngle + frac * angleSpan;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            
            const isRed = i >= 6.5;
            const tickOuter = r * 0.86;
            const tickInner = r * 0.74;
            
            ctx.beginPath();
            ctx.moveTo(cx + cosA * tickInner, cy + sinA * tickInner);
            ctx.lineTo(cx + cosA * tickOuter, cy + sinA * tickOuter);
            ctx.strokeStyle = isRed ? colors.redline : colors.tickMajor;
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Number label
            const textR = r * 0.62;
            ctx.fillStyle = isRed ? colors.redline : colors.text;
            ctx.fillText(i.toString(), cx + cosA * textR, cy + sinA * textR);
            
            // Sub-ticks
            if (i < 8) {
                for (let j = 1; j <= 3; j++) {
                    const subFrac = frac + (j / 4) * (1 / 8);
                    const subAngle = startAngle + subFrac * angleSpan;
                    const subCos = Math.cos(subAngle);
                    const subSin = Math.sin(subAngle);
                    
                    ctx.beginPath();
                    ctx.moveTo(cx + subCos * (r * 0.82), cy + subSin * (r * 0.82));
                    ctx.lineTo(cx + subCos * tickOuter, cy + subSin * tickOuter);
                    ctx.strokeStyle = (subFrac * maxRpm >= redlineStart) ? colors.redline : colors.tickMinor;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            }
        }
        
        // Needle
        const needleColor = rpm >= redlineStart ? colors.redline : colors.accent;
        this.drawNeedle(cx, cy, r * 0.82, activeAngle, needleColor, colors.needleGlow);
        
        // Center Gear & RPM label
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Gear display
        ctx.font = `800 ${Math.round(r * 0.28)}px 'Segoe UI', monospace, sans-serif`;
        ctx.fillStyle = colors.text;
        const gearText = physics.gearMode === 'D' ? `${physics.gear}` : physics.gearMode;
        ctx.fillText(gearText, cx, cy + r * 0.22);
        
        // Label
        ctx.font = `600 ${Math.round(r * 0.09)}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = colors.accent;
        ctx.fillText('RPM x 1000', cx, cy + r * 0.40);
        
        // Rev limiter warning blink
        if (physics.revLimiterActive) {
            ctx.fillStyle = colors.redline;
            ctx.font = `700 ${Math.round(r * 0.08)}px 'Segoe UI', sans-serif`;
            ctx.fillText('REV LIMIT', cx, cy - r * 0.32);
        }
    }
    
    drawDialBase(cx, cy, r, colors) {
        const ctx = this.ctx;
        
        // Outer metallic rim
        const gradRim = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r);
        gradRim.addColorStop(0, colors.rimInner);
        gradRim.addColorStop(0.85, colors.rimOuter);
        gradRim.addColorStop(1, '#000000');
        
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = gradRim;
        ctx.fill();
        
        // Inner dial body
        const gradBody = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.92);
        gradBody.addColorStop(0, colors.dialBg);
        gradBody.addColorStop(0.95, '#020408');
        
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        ctx.fillStyle = gradBody;
        ctx.fill();
        
        // Arc Track background
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.86, Math.PI * 0.75, Math.PI * 2.25);
        ctx.strokeStyle = colors.arcTrack;
        ctx.lineWidth = 6;
        ctx.stroke();
    }
    
    drawNeedle(cx, cy, length, angle, color, glowColor) {
        const ctx = this.ctx;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        
        // Needle glow
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 14;
        
        // Needle body (tapered)
        ctx.beginPath();
        ctx.moveTo(0, -3.5);
        ctx.lineTo(length, 0);
        ctx.lineTo(0, 3.5);
        ctx.lineTo(-length * 0.18, 0);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        
        // Center hub cap
        ctx.beginPath();
        ctx.arc(0, 0, length * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = '#111827';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();
        
        // Inner hub center point
        ctx.beginPath();
        ctx.arc(0, 0, length * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        ctx.restore();
    }
    
    drawCenterHUD(cx, cy, w, h, physics, colors) {
        const ctx = this.ctx;
        const mode = physics.getDriveMode();
        
        // HUD Background panel
        ctx.fillStyle = colors.hudBg;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        
        const rw = w * 0.95;
        const rh = h * 0.85;
        const rx = cx - rw / 2;
        const ry = cy - rh / 2;
        
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(rx, ry, rw, rh, 14);
        } else {
            ctx.rect(rx, ry, rw, rh);
        }
        ctx.fill();
        ctx.stroke();
        
        // Drive Mode Badge
        ctx.fillStyle = mode.accentColor;
        ctx.font = `700 13px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(mode.name + ' MODE', cx, ry + 26);
        
        // Shift Mode Selector Display (P R N D)
        const gearModes = ['P', 'R', 'N', 'D'];
        const modeSpacing = rw / 5;
        ctx.font = `700 14px 'Segoe UI', monospace`;
        
        gearModes.forEach((gm, idx) => {
            const gx = rx + modeSpacing * (idx + 1);
            const gy = ry + 56;
            if (physics.gearMode === gm) {
                ctx.fillStyle = colors.accent;
                ctx.fillText(`[${gm}]`, gx, gy);
            } else {
                ctx.fillStyle = '#64748b';
                ctx.fillText(gm, gx, gy);
            }
        });
        
        // G-Force Indicator Meter
        ctx.fillStyle = colors.text;
        ctx.font = `600 11px 'Segoe UI', sans-serif`;
        ctx.fillText('LONGITUDINAL G', cx, ry + 88);
        
        const gVal = physics.gForce.toFixed(2);
        ctx.font = `700 16px 'Segoe UI', monospace`;
        ctx.fillStyle = colors.accent;
        ctx.fillText(`${gVal > 0 ? '+' : ''}${gVal} G`, cx, ry + 110);
        
        // Throttle & Brake level mini-bars
        const barWidth = rw * 0.7;
        const barHeight = 6;
        const barX = cx - barWidth / 2;
        
        // Throttle bar (Green/Cyan)
        ctx.fillStyle = '#64748b';
        ctx.font = `600 10px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('THROTTLE', barX, ry + 134);
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(physics.effectiveThrottle * 100)}%`, barX + barWidth, ry + 134);
        
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(barX, ry + 140, barWidth, barHeight);
        ctx.fillStyle = colors.accent;
        ctx.fillRect(barX, ry + 140, barWidth * physics.effectiveThrottle, barHeight);
        
        // Brake bar (Red)
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748b';
        ctx.fillText('BRAKE', barX, ry + 162);
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(physics.brake * 100)}%`, barX + barWidth, ry + 162);
        
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(barX, ry + 168, barWidth, barHeight);
        ctx.fillStyle = colors.redline;
        ctx.fillRect(barX, ry + 168, barWidth * physics.brake, barHeight);
        
        // Odometer & Trip
        ctx.textAlign = 'center';
        ctx.fillStyle = '#94a3b8';
        ctx.font = `500 11px 'Segoe UI', monospace`;
        ctx.fillText(`TRIP: ${physics.tripMeter.toFixed(1)} km`, cx, ry + rh - 30);
        
        ctx.fillStyle = colors.text;
        ctx.font = `600 12px 'Segoe UI', monospace`;
        ctx.fillText(`ODO: ${Math.floor(physics.odometer).toLocaleString()} km`, cx, ry + rh - 12);
    }
}

if (typeof window !== 'undefined') {
    window.GaugeCluster = GaugeCluster;
}
