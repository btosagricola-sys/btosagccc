package br.com.btos.captchatest;

import java.util.Arrays;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.inventory.GuiChest;
import net.minecraft.command.CommandBase;
import net.minecraft.command.CommandException;
import net.minecraft.command.ICommandSender;
import net.minecraft.init.Blocks;
import net.minecraft.inventory.ContainerChest;
import net.minecraft.inventory.IInventory;
import net.minecraft.inventory.Slot;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.util.ChatComponentText;
import net.minecraftforge.client.ClientCommandHandler;
import net.minecraftforge.fml.common.FMLCommonHandler;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;
import net.minecraftforge.fml.common.gameevent.TickEvent;

@Mod(modid = "captchatest", name = "Captcha Test", version = "1.1.1",
     acceptedMinecraftVersions = "[1.8.9]", clientSideOnly = true)
public final class CaptchaTest {
    private final Minecraft mc = Minecraft.getMinecraft();
    private final GreenChallenge.Tracker tracker = new GreenChallenge.Tracker();
    private boolean enabled;
    private boolean preview;
    private Object connection;
    private String lastAction = "Nenhum clique realizado.";

    @Mod.EventHandler
    public void init(FMLInitializationEvent event) {
        FMLCommonHandler.instance().bus().register(this);
        ClientCommandHandler.instance.registerCommand(new Control());
    }

    @SubscribeEvent
    public void tick(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) return;
        if (mc.thePlayer == null || mc.theWorld == null) {
            enabled = false;
            connection = null;
            tracker.reset();
            return;
        }
        if (connection != mc.getNetHandler()) {
            connection = mc.getNetHandler();
            enabled = true;
            preview = false;
            tracker.reset();
            lastAction = "Nenhum clique realizado nesta conexao.";
            message("v1.1.1 ativado automaticamente. Use /captchatest off para desativar.");
        }
        ContainerChest chest = currentChest();
        if (!enabled || chest == null) {
            tracker.reset();
            return;
        }
        int target = tracker.tick(chest, target(chest));
        if (target < 0) return;
        IInventory inventory = chest.getLowerChestInventory();
        Slot slot = chest.getSlot(target);
        if (slot.inventory != inventory || slot.getSlotIndex() != target) {
            lastAction = "Slot inesperado; nenhum clique enviado.";
        } else if (preview) {
            lastAction = "Verde detectado: linha " + (target / 9 + 1)
                    + ", coluna " + (target % 9 + 1) + " (simulacao, sem clique).";
        } else if (mc.thePlayer.inventory.getItemStack() != null) {
            lastAction = "Ha um item no cursor; nenhum clique enviado. Feche o menu e tente novamente.";
        } else {
            // Normal left click, using the current server window and actual slot number.
            mc.playerController.windowClick(chest.windowId, slot.slotNumber, 0, 0, mc.thePlayer);
            lastAction = "Clique enviado no verde: linha " + (target / 9 + 1)
                    + ", coluna " + (target % 9 + 1) + ".";
        }
        message(lastAction);
    }

    private ContainerChest currentChest() {
        if (!(mc.currentScreen instanceof GuiChest)
                || !(mc.thePlayer.openContainer instanceof ContainerChest)) return null;
        return (ContainerChest) mc.thePlayer.openContainer;
    }

    private int target(ContainerChest chest) {
        IInventory inventory = chest.getLowerChestInventory();
        int[] colors = new int[inventory.getSizeInventory()];
        Arrays.fill(colors, -1);
        for (int i = 0; i < colors.length; i++) {
            ItemStack stack = inventory.getStackInSlot(i);
            if (stack != null && (stack.getItem() == Item.getItemFromBlock(Blocks.stained_glass_pane)
                    || stack.getItem() == Item.getItemFromBlock(Blocks.stained_glass))) {
                colors[i] = stack.getMetadata();
            }
        }
        return GreenChallenge.findTarget(inventory.getDisplayName().getUnformattedText(), colors);
    }

    private void message(String text) {
        if (mc.thePlayer != null) mc.thePlayer.addChatMessage(new ChatComponentText("[CaptchaTest] " + text));
    }

    private void diagnostic() {
        message("v1.1.1 - " + (enabled ? (preview ? "SIMULACAO: nao clica" : "CLIQUE ATIVO") : "DESATIVADO"));
        ContainerChest chest = currentChest();
        if (chest == null) message("Nenhum menu de bau aberto.");
        else {
            IInventory inventory = chest.getLowerChestInventory();
            message("Menu: [" + inventory.getDisplayName().getUnformattedText() + "]; slots: " + inventory.getSizeInventory());
            int selected = target(chest);
            message(selected < 0 ? "Padrao esperado nao encontrado: 27 vidros, 26 vermelhos e 1 verde."
                    : "Verde: linha " + (selected / 9 + 1) + ", coluna " + (selected % 9 + 1));
        }
        message(lastAction);
    }

    private final class Control extends CommandBase {
        @Override public String getCommandName() { return "captchatest"; }
        @Override public String getCommandUsage(ICommandSender sender) {
            return "/captchatest <preview|on|off|status>";
        }
        @Override public boolean canCommandSenderUseCommand(ICommandSender sender) { return true; }
        @Override public void processCommand(ICommandSender sender, String[] args) throws CommandException {
            if (args.length != 1) { message(getCommandUsage(sender)); return; }
            if ("off".equalsIgnoreCase(args[0])) { enabled = false; tracker.reset(); }
            else if ("on".equalsIgnoreCase(args[0]) || "preview".equalsIgnoreCase(args[0])) {
                preview = "preview".equalsIgnoreCase(args[0]);
                enabled = true;
                connection = mc.getNetHandler();
                tracker.reset();
            } else if (!"status".equalsIgnoreCase(args[0])) {
                message(getCommandUsage(sender)); return;
            }
            diagnostic();
        }
    }
}
