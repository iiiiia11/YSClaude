package com.ysclaude.app

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap

class AndroidSystemToolsModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "AndroidSystemTools"

  private fun hasUsageAccess(): Boolean {
    val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        reactContext.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        reactContext.packageName
      )
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  @ReactMethod
  fun openUsageAccessSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("OPEN_USAGE_SETTINGS_FAILED", error)
    }
  }

  @ReactMethod
  fun getAppUsageStats(startTime: Double, endTime: Double, limit: Double, promise: Promise) {
    try {
      val result = WritableNativeMap()
      val permissionGranted = hasUsageAccess()
      result.putBoolean("permissionGranted", permissionGranted)
      result.putString("permissionAction", Settings.ACTION_USAGE_ACCESS_SETTINGS)
      if (!permissionGranted) {
        result.putString("message", "需要在系统设置中为 YSClaude 授予“使用情况访问权限”后才能读取应用使用时间。")
        result.putArray("apps", WritableNativeArray())
        promise.resolve(result)
        return
      }

      val usageStatsManager = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usageStatsManager
        .queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime.toLong(), endTime.toLong())
        .orEmpty()
        .filter { it.totalTimeInForeground > 0 }
        .groupBy { it.packageName }
        .map { (packageName, rows) ->
          val total = rows.sumOf { it.totalTimeInForeground }
          val lastUsed = rows.maxOf { it.lastTimeUsed }
          Triple(packageName, total, lastUsed)
        }
        .sortedByDescending { it.second }
        .take(limit.toInt().coerceIn(1, 100))

      val apps = WritableNativeArray()
      val packageManager = reactContext.packageManager
      stats.forEach { (packageName, totalForegroundMs, lastTimeUsed) ->
        val app = WritableNativeMap()
        app.putString("packageName", packageName)
        app.putString("appName", getAppLabel(packageManager, packageName))
        app.putDouble("totalTimeInForegroundMs", totalForegroundMs.toDouble())
        app.putDouble("totalTimeInForegroundMinutes", totalForegroundMs / 60000.0)
        app.putDouble("lastTimeUsed", lastTimeUsed.toDouble())
        apps.pushMap(app)
      }

      result.putArray("apps", apps)
      result.putDouble("startTime", startTime)
      result.putDouble("endTime", endTime)
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("GET_APP_USAGE_STATS_FAILED", error)
    }
  }

  private fun getAppLabel(packageManager: PackageManager, packageName: String): String {
    return try {
      val info = packageManager.getApplicationInfo(packageName, 0)
      packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) {
      packageName
    }
  }
}
