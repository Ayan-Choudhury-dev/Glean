# @glean/barcode-scanner

Barcode scanning for Glean

## Install

To use npm

```bash
npm install @glean/barcode-scanner
````

To use yarn

```bash
yarn add @glean/barcode-scanner
```

Sync native files

```bash
npx cap sync
```

## API

<docgen-index>

* [`scan()`](#scan)
* [`checkPermissions()`](#checkpermissions)
* [`requestPermissions()`](#requestpermissions)
* [Interfaces](#interfaces)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### scan()

```typescript
scan() => Promise<ScanResult>
```

Open the camera and resolve with the first barcode scanned.

**Returns:** <code>Promise&lt;<a href="#scanresult">ScanResult</a>&gt;</code>

**Since:** 0.0.1

--------------------


### checkPermissions()

```typescript
checkPermissions() => Promise<PermissionStatus>
```

Report the current camera permission state.

**Returns:** <code>Promise&lt;<a href="#permissionstatus">PermissionStatus</a>&gt;</code>

**Since:** 0.0.1

--------------------


### requestPermissions()

```typescript
requestPermissions() => Promise<PermissionStatus>
```

Ask for camera permission.

**Returns:** <code>Promise&lt;<a href="#permissionstatus">PermissionStatus</a>&gt;</code>

**Since:** 0.0.1

--------------------


### Interfaces


#### ScanResult

| Prop          | Type                | Description                                     |
| ------------- | ------------------- | ----------------------------------------------- |
| **`barcode`** | <code>string</code> | The decoded barcode value.                      |
| **`format`**  | <code>string</code> | The symbology that produced it (e.g. "ean_13"). |


#### PermissionStatus

| Prop         | Type                                           |
| ------------ | ---------------------------------------------- |
| **`camera`** | <code>'prompt' \| 'granted' \| 'denied'</code> |

</docgen-api>
