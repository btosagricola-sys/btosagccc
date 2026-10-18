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

@Mod(modid = "captchatest", name = "Captcha Test", version = "1.0.2",
     acceptedMinecraftVersions = "[1.8.9]", clientSideOnly = true)
public final class CaptchaTest {
    private final Minecraft mc = Minecraft.getMinecraft();
    private boolean enabled;
    private boolean preview = true;
    private Field title;
    private Field subtitle;
    private Field titlesTimer;
    private String lastAction = "Nenhuma resposta enviada.";
    private String previous = "";
    private String pending;
    private int delay;
    private Object connection;

    @Mod.EventHandler
    public void init(FMLInitializationEvent event) {
        title = ReflectionHelper.findField(GuiIngame.class, "displayedTitle", "field_175201_x");
        subtitle = ReflectionHelper.findField(GuiIngame.class, "displayedSubTitle", "field_175200_y");
        titlesTimer = ReflectionHelper.findField(GuiIngame.class, "titlesTimer", "field_175195_w");
        FMLCommonHandler.instance().bus().register(this);
        ClientCommandHandler.instance.registerCommand(new Control());
    }

    @SubscribeEvent
    public void tick(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) return;
        if (mc.thePlayer == null || mc.theWorld == null) {
            enabled = false;
            previous = "";
            pending = null;
            connection = null;
            return;
        }
        if (connection != mc.getNetHandler()) {
            connection = mc.getNetHandler();
            enabled = false;
            previous = "";
            pending = null;
            lastAction = "Nenhuma resposta enviada nesta conexao.";
            message("v1.0.2 carregado e DESATIVADO. Use /captchatest preview ou /captchatest on.");
        }
        if (!enabled) return;
        try {
            String first = (String) title.get(mc.ingameGUI);
            String second = (String) subtitle.get(mc.ingameGUI);
            String candidate = extract(first);
            if (candidate == null) candidate = extract(second);
            if (titlesTimer.getInt(mc.ingameGUI) <= 0) candidate = null;
            String current = candidate == null ? "" : candidate;
            if (!current.equals(previous)) {
                previous = current;
                pending = candidate;
                delay = 20;
            }
            if (pending != null && --delay <= 0) {
                String answer = "/colher " + pending;
                pending = null;
                if (preview) lastAction = "Detectado: " + answer + " (simulacao, nao enviado)";
                else {
                    mc.thePlayer.sendChatMessage(answer);
                    lastAction = "Enviado ao servidor: " + answer;
                }
                message(lastAction);
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

    private void diagnostic() {
        message("v1.0.2 - " + (enabled ? (preview ? "SIMULACAO: nao envia comandos" : "ENVIO ATIVO") : "DESATIVADO"));
        try {
            message("Titulo lido: [" + readable((String) title.get(mc.ingameGUI)) + "]");
            message("Subtitulo lido: [" + readable((String) subtitle.get(mc.ingameGUI)) + "]");
            message("Tempo restante do titulo: " + titlesTimer.getInt(mc.ingameGUI) + " ticks.");
            message(lastAction);
        } catch (IllegalAccessException error) {
            message("Nao foi possivel acessar o titulo.");
        }
    }

    private String readable(String text) {
        if (text == null || text.isEmpty()) return "vazio";
        String clean = EnumChatFormatting.getTextWithoutFormattingCodes(text);
        return clean.substring(0, Math.min(160, clean.length())).replace('\n', ' ');
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
            diagnostic();
        }
    }
}
