import { BarcodeScanner } from '@glean/barcode-scanner';

window.testEcho = () => {
    const inputValue = document.getElementById("echoInput").value;
    BarcodeScanner.echo({ value: inputValue })
}
