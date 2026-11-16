package br.com.btos.captchatest;

import java.text.Normalizer;
import java.util.Locale;

/** Rules independent of Minecraft, so inventory selection can be tested. */
final class GreenChallenge {
    static int findTarget(String title, int[] colors) {
        if (title == null || colors == null || colors.length != 27) return -1;
        String plain = title.replaceAll("\u00a7[0-9A-FK-ORa-fk-or]", "");
        plain = Normalizer.normalize(plain, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").trim().toUpperCase(Locale.ROOT);
        if (!"VERIFICACAO ANTI-MACRO".equals(plain)) return -1;
        int target = -1;
        for (int i = 0; i < colors.length; i++) {
            if (colors[i] == 5 || colors[i] == 13) {
                if (target >= 0) return -1;
                target = i;
            } else if (colors[i] != 14) return -1;
        }
        return target;
    }

    /** At most one action per open container, after a stable ten-tick target. */
    static final class Tracker {
        private Object window;
        private int candidate = -1;
        private int ticks;
        private boolean handled;

        int tick(Object currentWindow, int target) {
            if (window != currentWindow) {
                reset();
                window = currentWindow;
            }
            if (currentWindow == null || handled) return -1;
            if (target < 0) {
                candidate = -1;
                ticks = 0;
                return -1;
            }
            if (candidate != target) {
                candidate = target;
                ticks = 0;
            }
            if (++ticks < 10) return -1;
            handled = true;
            return target;
        }

        void reset() {
            window = null;
            candidate = -1;
            ticks = 0;
            handled = false;
        }
    }
}
