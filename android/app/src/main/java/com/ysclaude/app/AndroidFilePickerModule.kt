package com.ysclaude.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class AndroidFilePickerModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "AndroidFilePicker"

  private var pendingPromise: Promise? = null

  private val activityEventListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_PICK_READING_BOOK) return

      val promise = pendingPromise ?: return
      pendingPromise = null

      if (resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return
      }

      val uri = data?.data
      if (uri == null) {
        promise.reject("PICK_FILE_FAILED", "No file URI returned")
        return
      }

      promise.resolve(buildFileResult(uri))
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  @ReactMethod
  fun pickReadingBook(promise: Promise) {
    openFileChooser(promise, "选择电子书来源", REQUEST_PICK_READING_BOOK)
  }

  private fun openFileChooser(promise: Promise, title: String, requestCode: Int) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Current Android activity is not available")
      return
    }
    if (pendingPromise != null) {
      promise.reject("PICKER_BUSY", "A file picker is already open")
      return
    }

    pendingPromise = promise

    val openIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    val chooser = Intent.createChooser(openIntent, title)

    try {
      activity.startActivityForResult(chooser, requestCode)
    } catch (error: Exception) {
      pendingPromise = null
      promise.reject("OPEN_PICKER_FAILED", error)
    }
  }

  private fun buildFileResult(uri: Uri): WritableNativeMap {
    val result = WritableNativeMap()
    val resolver = reactContext.contentResolver

    result.putString("uri", uri.toString())
    result.putString("mimeType", resolver.getType(uri))

    var name: String? = null
    var size: Double? = null

    try {
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
        ?.use { cursor ->
          if (cursor.moveToFirst()) {
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex >= 0) name = cursor.getString(nameIndex)

            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
              size = cursor.getLong(sizeIndex).toDouble()
            }
          }
        }
    } catch (_: Exception) {
      // Metadata is best-effort. JS will fall back to the URI if needed.
    }

    result.putString("name", name ?: uri.lastPathSegment ?: "未命名文件")
    if (size != null) result.putDouble("size", size!!)

    return result
  }

  companion object {
    private const val REQUEST_PICK_READING_BOOK = 4108
  }
}
