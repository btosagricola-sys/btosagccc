package br.com.btos.captchatest;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Random;
import java.util.function.LongSupplier;

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

    /** At most one action per opening, after a random monotonic-time delay. */
    static final class Tracker {
        private Object window;
        private int candidate = -1;
        private final LongSupplier clock;
        private final Random random;
        private long startedAt;
        private int delayMillis = -1;

        Tracker() { this(System::nanoTime, new Random()); }

        Tracker(LongSupplier clock, Random random) {
            this.clock = clock;
            this.random = random;
        }

        int delayMillis() { return delayMillis; }

        private int nextDelay() {
            // Uniform over 800..1500, excluding the previous chosen value.
            boolean hasPrevious = delayMillis >= 800 && delayMillis <= 1500;
            int chosen = 800 + random.nextInt(hasPrevious ? 700 : 701);
            if (hasPrevious && chosen >= delayMillis) chosen++;
            return chosen;
        }
        private boolean handled;

        int tick(Object currentWindow, int target) {
            if (window != currentWindow) {
                reset();
                window = currentWindow;
            }
            if (currentWindow == null || handled) return -1;
            if (target < 0) {
                candidate = -1;
                startedAt = 0;
                return -1;
            }
            if (candidate != target) {
                candidate = target;
                startedAt = clock.getAsLong();
                delayMillis = nextDelay();
            }
            if (clock.getAsLong() - startedAt < delayMillis * 1_000_000L) return -1;
            handled = true;
            return target;
        }

        void reset() {
            window = null;
            candidate = -1;
            startedAt = 0;
            handled = false;
        }
    }
}
