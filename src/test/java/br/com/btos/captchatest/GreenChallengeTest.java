package br.com.btos.captchatest;

import java.util.Arrays;
import java.util.Random;
import java.util.function.LongSupplier;
import static org.junit.Assert.assertTrue;
import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class GreenChallengeTest {
    private int[] board(int target, int color) {
        int[] colors = new int[27];
        Arrays.fill(colors, 14);
        colors[target] = color;
        return colors;
    }

    @Test public void findsMovingGreenInEveryChestSlot() {
        for (int i = 0; i < 27; i++) {
            assertEquals(i, GreenChallenge.findTarget("VERIFICAÇÃO ANTI-MACRO", board(i, 5)));
            assertEquals(i, GreenChallenge.findTarget("VERIFICAÇÃO ANTI-MACRO", board(i, 13)));
        }
    }

    @Test public void acceptsColorCodesAndAccents() {
        assertEquals(13, GreenChallenge.findTarget("\u00a7c\u00a7lVERIFICAÇÃO ANTI-MACRO", board(13, 5)));
    }

    @Test public void rejectsOtherMenusAndPlayerInventorySizedArrays() {
        assertEquals(-1, GreenChallenge.findTarget("Chest", board(13, 5)));
        assertEquals(-1, GreenChallenge.findTarget("VERIFICAÇÃO ANTI-MACRO", new int[63]));
    }

    @Test public void rejectsMissingOrAmbiguousTargets() {
        int[] colors = board(13, 14);
        assertEquals(-1, GreenChallenge.findTarget("VERIFICAÇÃO ANTI-MACRO", colors));
        colors[0] = 5; colors[1] = 13;
        assertEquals(-1, GreenChallenge.findTarget("VERIFICAÇÃO ANTI-MACRO", colors));
    }

    @Test public void rejectsNonGlassItemsAndEmptySlots() {
        int[] colors = board(13, 5);
        colors[26] = -1;
        assertEquals(-1, GreenChallenge.findTarget("VERIFICAÇÃO ANTI-MACRO", colors));
    }

    private static final class Clock implements LongSupplier {
        long now;
        public long getAsLong() { return now; }
        void advance(int millis) { now += millis * 1_000_000L; }
    }

    @Test public void clicksAtDeadlineOnlyOnceAndRearmsForNewWindow() {
        Clock clock = new Clock();
        GreenChallenge.Tracker tracker = new GreenChallenge.Tracker(clock, new Random(42));
        Object first = new Object();
        assertEquals(-1, tracker.tick(first, 13));
        int delay = tracker.delayMillis();
        clock.advance(delay - 1);
        assertEquals(-1, tracker.tick(first, 13));
        clock.advance(1);
        assertEquals(13, tracker.tick(first, 13));
        clock.advance(5000);
        assertEquals(-1, tracker.tick(first, 13));
        assertEquals(-1, tracker.tick(first, 9));
        Object second = new Object();
        assertEquals(-1, tracker.tick(second, 2));
        assertTrue(delay != tracker.delayMillis());
        clock.advance(tracker.delayMillis());
        assertEquals(2, tracker.tick(second, 2));
    }

    @Test public void revalidatesWhenGreenMovesDuringDelay() {
        Clock clock = new Clock();
        GreenChallenge.Tracker tracker = new GreenChallenge.Tracker(clock, new Random(2));
        Object window = new Object();
        assertEquals(-1, tracker.tick(window, 0));
        clock.advance(tracker.delayMillis() - 1);
        assertEquals(-1, tracker.tick(window, 26));
        clock.advance(tracker.delayMillis() - 1);
        assertEquals(-1, tracker.tick(window, 26));
        clock.advance(1);
        assertEquals(26, tracker.tick(window, 26));
    }

    @Test public void cancelsWhenWindowClosesOrBoardBecomesInvalid() {
        Clock clock = new Clock();
        GreenChallenge.Tracker tracker = new GreenChallenge.Tracker(clock, new Random(3));
        Object window = new Object();
        assertEquals(-1, tracker.tick(window, 13));
        clock.advance(700);
        assertEquals(-1, tracker.tick(window, -1));
        assertEquals(-1, tracker.tick(window, 13));
        assertEquals(-1, tracker.tick(null, 13));
        clock.advance(5000);
        assertEquals(-1, tracker.tick(window, 13));
        clock.advance(tracker.delayMillis());
        assertEquals(13, tracker.tick(window, 13));
    }

    @Test public void samplesWithinBoundsAndNeverRepeatsPreviousDelay() {
        Clock clock = new Clock();
        GreenChallenge.Tracker tracker = new GreenChallenge.Tracker(clock, new Random(123));
        int previous = -1;
        boolean sawMinimum = false, sawMaximum = false;
        for (int i = 0; i < 10000; i++) {
            tracker.reset();
            assertEquals(-1, tracker.tick(new Object(), 13));
            int delay = tracker.delayMillis();
            assertTrue(delay >= 800 && delay <= 1500);
            assertTrue(delay != previous);
            sawMinimum |= delay == 800;
            sawMaximum |= delay == 1500;
            previous = delay;
        }
        assertTrue(sawMinimum && sawMaximum);
    }
}
