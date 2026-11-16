package br.com.btos.captchatest;

import java.util.Arrays;
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

    @Test public void clicksOnceAfterTenStableTicksAndRearmsForNewWindow() {
        GreenChallenge.Tracker tracker = new GreenChallenge.Tracker();
        Object first = new Object();
        for (int i = 0; i < 9; i++) assertEquals(-1, tracker.tick(first, 13));
        assertEquals(13, tracker.tick(first, 13));
        for (int i = 0; i < 50; i++) assertEquals(-1, tracker.tick(first, 13));
        // A change in the same already-handled window must not cause a second click.
        for (int i = 0; i < 20; i++) assertEquals(-1, tracker.tick(first, 9));
        Object second = new Object();
        for (int i = 0; i < 9; i++) assertEquals(-1, tracker.tick(second, 2));
        assertEquals(2, tracker.tick(second, 2));
    }

    @Test public void revalidatesWhenGreenMovesDuringDelay() {
        GreenChallenge.Tracker tracker = new GreenChallenge.Tracker();
        Object window = new Object();
        for (int i = 0; i < 9; i++) assertEquals(-1, tracker.tick(window, 0));
        for (int i = 0; i < 9; i++) assertEquals(-1, tracker.tick(window, 26));
        assertEquals(26, tracker.tick(window, 26));
    }

    @Test public void cancelsWhenWindowClosesOrBoardBecomesInvalid() {
        GreenChallenge.Tracker tracker = new GreenChallenge.Tracker();
        Object window = new Object();
        for (int i = 0; i < 9; i++) assertEquals(-1, tracker.tick(window, 13));
        assertEquals(-1, tracker.tick(window, -1));
        assertEquals(-1, tracker.tick(window, 13));
        assertEquals(-1, tracker.tick(null, 13));
        for (int i = 0; i < 9; i++) assertEquals(-1, tracker.tick(window, 13));
        assertEquals(13, tracker.tick(window, 13));
    }
}
