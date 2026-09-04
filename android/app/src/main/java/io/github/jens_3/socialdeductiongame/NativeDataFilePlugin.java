package io.github.jens_3.socialdeductiongame;

import android.app.Activity;
import android.content.Intent;
import android.content.ContentResolver;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.util.Locale;

@CapacitorPlugin(name = "NativeDataFile")
public class NativeDataFilePlugin extends Plugin {

	@PluginMethod
	public void writeExternal(PluginCall call) {
		String bytesBase64 = call.getString("bytesBase64");
		String suggestedFileName = call.getString("suggestedFileName");
		if (bytesBase64 == null || suggestedFileName == null) {
			call.reject("Exportdaten oder vorgeschlagener Dateiname fehlen.");
			return;
		}

		Intent intent = createDocumentIntent(suggestedFileName);
		startActivityForResult(call, intent, "writeExternalResult");
	}

	static Intent createDocumentIntent(String suggestedFileName) {
		Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
		intent.addCategory(Intent.CATEGORY_OPENABLE);
		intent.setType("application/json");
		intent.putExtra(Intent.EXTRA_TITLE, safeJsonFileName(suggestedFileName));
		intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
		return intent;
	}

	@ActivityCallback
	public void writeExternalResult(PluginCall call, ActivityResult result) {
		if (result.getResultCode() != Activity.RESULT_OK) {
			JSObject cancelled = new JSObject();
			cancelled.put("status", "cancelled");
			call.resolve(cancelled);
			return;
		}

		Intent data = result.getData();
		Uri target = data == null ? null : data.getData();
		String bytesBase64 = call.getString("bytesBase64");
		if (target == null || bytesBase64 == null) {
			call.reject("Der gewählte Speicherort oder die Exportdaten fehlen.");
			return;
		}

		try {
			writeBytes(getContext().getContentResolver(), target, Base64.decode(bytesBase64, Base64.DEFAULT));
			JSObject success = new JSObject();
			success.put("status", "success");
			call.resolve(success);
		} catch (Exception error) {
			call.reject("Die Datei konnte nicht exportiert werden.", error);
		}
	}

	static void writeBytes(ContentResolver resolver, Uri target, byte[] bytes) throws Exception {
		try (OutputStream output = resolver.openOutputStream(target, "wt")) {
			if (output == null) {
				throw new IllegalStateException("Der gewählte Speicherort konnte nicht geöffnet werden.");
			}
			output.write(bytes);
			output.flush();
		}
	}

	private static String safeJsonFileName(String value) {
		String safe = value.trim().replace('/', '_').replace('\\', '_');
		if (safe.isEmpty()) safe = "export.json";
		if (!safe.toLowerCase(Locale.ROOT).endsWith(".json")) safe += ".json";
		return safe;
	}
}
