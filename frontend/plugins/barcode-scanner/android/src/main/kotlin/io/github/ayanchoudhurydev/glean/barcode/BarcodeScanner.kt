package io.github.ayanchoudhurydev.glean.barcode

import com.getcapacitor.Logger

class BarcodeScanner {

    fun echo(value: String): String {
        Logger.info("Echo", value)

        return value
    }
}
