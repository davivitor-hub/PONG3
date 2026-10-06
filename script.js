* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    background-color: #05050d;
    color: #fff;
    font-family: 'Orbitron', sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    overflow: hidden;
    user-select: none;
}

.canvas-container {
    position: relative;
    border-radius: 16px;
    padding: 4px;
    background: linear-gradient(135deg, #ff007f, #00f0ff);
    box-shadow: 0 0 35px rgba(0, 240, 255, 0.4), 0 0 50px rgba(255, 0, 127, 0.25);
    transition: transform 0.05s ease-out;
}

canvas {
    display: block;
    border-radius: 12px;
    background-color: #080814;
    cursor: pointer;
}

/* UI Overlay de Multiplayer */
.multiplayer-ui {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(5, 5, 20, 0.88);
    backdrop-filter: blur(6px);
    border-radius: 12px;
    z-index: 10;
}

.multiplayer-ui.hidden, .hidden {
    display: none !important;
}

.ui-card {
    background: rgba(12, 12, 28, 0.95);
    border: 2px solid #00f0ff;
    box-shadow: 0 0 30px rgba(0, 240, 255, 0.35);
    padding: 28px;
    border-radius: 16px;
    text-align: center;
    max-width: 460px;
    width: 92%;
}

.ui-card h2 {
    color: #00f0ff;
    text-shadow: 0 0 12px #00f0ff;
    font-size: 20px;
    margin-bottom: 20px;
    letter-spacing: 1px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
    text-align: left;
}

.form-group label {
    font-size: 11px;
    color: #a0a0d0;
}

.form-group input[type="text"] {
    background: #080814;
    border: 1px solid #00f0ff;
    color: #ffe600;
    padding: 10px 14px;
    border-radius: 8px;
    font-family: 'Orbitron', sans-serif;
    font-size: 14px;
    outline: none;
    text-transform: uppercase;
}

.checkbox-group {
    flex-direction: row;
    align-items: center;
    gap: 10px;
}

.code-box {
    font-size: 38px;
    font-weight: 900;
    letter-spacing: 6px;
    color: #ff007f;
    text-shadow: 0 0 15px #ff007f;
    background: #080814;
    border: 1px dashed #ff007f;
    padding: 12px 20px;
    border-radius: 10px;
    margin: 15px 0;
}

.status-text {
    color: #ffe600;
    font-size: 12px;
    margin-bottom: 20px;
}

.error-text {
    color: #ff007f;
    font-size: 12px;
    margin: 10px 0;
    min-height: 18px;
}

.section-box {
    background: rgba(20, 20, 45, 0.6);
    border: 1px solid rgba(0, 240, 255, 0.3);
    padding: 12px;
    border-radius: 10px;
    margin-bottom: 14px;
}

.section-box h3 {
    font-size: 12px;
    color: #00f0ff;
    margin-bottom: 10px;
    text-align: left;
}

.inline-form {
    display: flex;
    gap: 8px;
}

.inline-form input {
    flex: 1;
    background: #080814;
    border: 1px solid #00f0ff;
    color: #fff;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: 'Orbitron', sans-serif;
    text-transform: uppercase;
}

.rooms-list {
    max-height: 130px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.room-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #080814;
    padding: 8px 12px;
    border-radius: 6px;
    border-left: 3px solid #ff007f;
    font-size: 12px;
}

.no-rooms {
    font-size: 11px;
    color: #777;
    padding: 10px;
}

.btn-group {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 15px;
}

.glow-btn {
    background: #00f0ff;
    color: #05050d;
    border: none;
    padding: 10px 16px;
    font-family: 'Orbitron', sans-serif;
    font-size: 12px;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 0 12px rgba(0, 240, 255, 0.5);
    transition: all 0.2s ease;
}

.glow-btn:hover {
    background: #ffffff;
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
    transform: translateY(-2px);
}

.glow-btn.cancel-btn {
    background: transparent;
    color: #ff007f;
    border: 1px solid #ff007f;
    box-shadow: 0 0 10px rgba(255, 0, 127, 0.3);
}

.glow-btn.cancel-btn:hover {
    background: #ff007f;
    color: #ffffff;
}
canvas { cursor: crosshair; touch-action: none; }
@media (max-width: 850px) { .canvas-container { width: min(96vw, 800px); } canvas { width:100%; height:auto; } }
