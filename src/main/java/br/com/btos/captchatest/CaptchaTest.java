package br.com.btos.captchatest;

import java.lang.reflect.Field;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiIngame;
import net.minecraft.command.CommandBase;
import net.minecraft.command.CommandException;
import net.minecraft.command.ICommandSender;
import net.minecraft.util.ChatComponentText;
import net.minecraft.util.EnumChatFormatting;
import net.minecraftforge.client.ClientCommandHandler;
import net.minecraftforge.fml.common.FMLCommonHandler;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;
import net.minecraftforge.fml.common.gameevent.TickEvent;
import net.minecraftforge.fml.relauncher.ReflectionHelper;

@Mod(modid = "captchatest", name = "Captcha Test", version = "1.0.1",
     acceptedMinecraftVersions = "[1.8.9]", clientSideOnly = true)
public final class CaptchaTest {
    private final Minecraft mc = Minecraft.getMinecraft();
    private boolean enabled;
    private boolean preview = true;
    private Field title;
    private Field subtitle;
    private String previous = "";
    private String pending;
    private int delay;
    private Object connection;

    @Mod.EventHandler
    public void init(FMLInitializationEvent event) {
        title = ReflectionHelper.findField(GuiIngame.class, "displayedTitle", "field_175201_x");
        subtitle = ReflectionHelper.findField(GuiIngame.class, "displayedSubTitle", "field_175200_y");
        FMLCommonHandler.instance().bus().register(this);
        ClientCommandHandler.instance.registerCommand(new Control());
    }

    @SubscribeEvent
    public void tick(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) return;
        if (mc.thePlayer == null || mc.theWorld == null || connection != mc.getNetHandler()) {
            enabled = false;
            previous = "";
            pending = null;
            connection = mc.getNetHandler();
            return;
        }
        if (!enabled) return;
        try {
            String first = (String) title.get(mc.ingameGUI);
            String second = (String) subtitle.get(mc.ingameGUI);
            String current = first + "\n" + second;
            if (!current.equals(previous)) {
                previous = current;
                pending = extract(first);
                if (pending == null) pending = extract(second);
                delay = 20;
            }
            if (pending != null && --delay <= 0) {
                String answer = "/colher " + pending;
                pending = null;
                if (preview) message("Detectado: " + answer + " (simulacao, nao enviado)");
                else mc.thePlayer.sendChatMessage(answer);
            }
        } catch (IllegalAccessException error) {
            enabled = false;
            pending = null;
            message("Falha ao ler o titulo; teste desativado.");
        }
    }

    static String extract(String text) {
        if (text == null) return null;
        String clean = EnumChatFormatting.getTextWithoutFormattingCodes(text).trim();
        return clean.matches("[0-9]{1,16}") ? clean : null;
    }

    private void message(String text) {
        if (mc.thePlayer != null) mc.thePlayer.addChatMessage(new ChatComponentText("[CaptchaTest] " + text));
    }

    private final class Control extends CommandBase {
        @Override public String getCommandName() { return "captchatest"; }
        @Override public String getCommandUsage(ICommandSender sender) {
            return "/captchatest <preview|on|off|status>";
        }
        @Override public boolean canCommandSenderUseCommand(ICommandSender sender) { return true; }
        @Override public void processCommand(ICommandSender sender, String[] args) throws CommandException {
            if (args.length != 1) { message(getCommandUsage(sender)); return; }
            if ("off".equalsIgnoreCase(args[0])) { enabled = false; pending = null; }
            else if ("on".equalsIgnoreCase(args[0]) || "preview".equalsIgnoreCase(args[0])) {
                if (mc.isSingleplayer()) { message("Conecte ao servidor de teste primeiro."); return; }
                preview = "preview".equalsIgnoreCase(args[0]);
                enabled = true;
                connection = mc.getNetHandler();
                previous = "";
                pending = null;
            } else if (!"status".equalsIgnoreCase(args[0])) {
                message(getCommandUsage(sender)); return;
            }
            message("Estado: " + (enabled ? (preview ? "simulacao" : "envio ativo") : "desativado"));
        }
    }
}
