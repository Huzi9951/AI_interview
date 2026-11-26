// Proctoring utilities

// =============================================
// Tab Switch / Focus Loss Detection
// =============================================
export function setupTabSwitchDetection(onViolation) {
    const handleVisibilityChange = () => {
        if (document.hidden) {
            onViolation({
                type: 'tab_switch',
                message: 'Tab switch or window minimized detected',
                timestamp: new Date().toISOString(),
            });
        }
    };

    const handleBlur = () => {
        onViolation({
            type: 'focus_loss',
            message: 'Window focus lost',
            timestamp: new Date().toISOString(),
        });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleBlur);
    };
}

// =============================================
// Fullscreen Enforcement
// =============================================
export function requestFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        return elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
        return elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        return elem.msRequestFullscreen();
    }
}

export function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    }
}

export function setupFullscreenDetection(onExit) {
    const handleFullscreenChange = () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            onExit();
        }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
}

// =============================================
// Violation Threshold Check
// =============================================
const MAX_VIOLATIONS = 5;

export function shouldTerminate(violationCount) {
    return violationCount >= MAX_VIOLATIONS;
}
