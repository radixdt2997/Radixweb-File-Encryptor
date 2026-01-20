# Quick Start Guide

## Getting Started

### Prerequisites

- Modern web browser (Chrome 37+, Firefox 34+, Safari 11+, Edge 79+)
- No installation required - all encryption happens in your browser!

### Opening the Application

**Option 1: Direct File Opening**

```bash
# Navigate to the project directory
cd /media/external/Desktop/Practice/Secure-File-App/secure-file-app/client

# Open index.html in your default browser
# On macOS: open index.html
# On Linux: xdg-open index.html
# On Windows: start index.html
```

**Option 2: Using a Local Server** (recommended for testing)

```bash
# Navigate to client directory
cd /media/external/Desktop/Practice/Secure-File-App/secure-file-app/client

# Start a simple HTTP server (Python 3)
python3 -m http.server 8000

# Open browser to http://localhost:8000
```

## Basic Workflow

### Encrypt a File

1. **Open index.html** in your browser
2. **Click "Select File"** and choose any file (PDF, image, document, etc.)
3. **Enter a password** (minimum 8 characters, e.g., "MySecurePass123")
4. **Click "🔒 Encrypt"**
5. **Wait** for processing (shows "Encrypting file..." message)
6. **Confirm download** of `your-file.enc` (encrypted file)

### Decrypt a File

1. **Click "Select File"** and choose a `.enc` encrypted file
2. **Enter the correct password** (same one used for encryption)
3. **Click "🔓 Decrypt"**
4. **Wait** for processing (shows "Decrypting file..." message)
5. **Confirm download** of your original file

## Testing Scenarios

### Test 1: Basic Encrypt/Decrypt

```
File: document.pdf
Password: test12345
Result: ✅ Encrypt → document.pdf.enc → Decrypt → document.pdf (identical)
```

### Test 2: Wrong Password

```
File: secret.txt (encrypted)
Password (wrong): wrongpass123
Result: ✅ Shows "Decryption failed: Incorrect password?"
```

### Test 3: Large File

```
File: video.mp4 (50MB)
Password: mypassword123
Result: ✅ Encrypts successfully (may take 10-30 seconds)
```

### Test 4: Empty File

```
File: empty.txt (0 bytes)
Password: test12345
Result: ✅ Shows "File cannot be empty."
```

### Test 5: Short Password

```
File: data.xlsx
Password: short (6 characters)
Result: ✅ Shows "Password must be at least 8 characters long."
```

## What Each Button Does

| Button         | Action                                                 |
| -------------- | ------------------------------------------------------ |
| 🔒 **Encrypt** | Encrypts selected file with password, downloads `.enc` |
| 🔓 **Decrypt** | Decrypts `.enc` file with password, downloads original |
| **Clear**      | Clears password, file selection, and all messages      |

## Understanding the UI

### File Input

- Shows selected file name
- Clears when "Clear" button is clicked
- Accepts any file type

### Password Input

- Shows dots (masked for privacy)
- Minimum 8 characters required
- Cleared when "Clear" button is clicked
- Never sent anywhere

### Message Area

- **Red (Error)**: Something went wrong
- **Green (Success)**: Operation completed successfully
- **Blue (Info)**: Processing in progress

### Status Indicator

- **Green dot**: Ready (idle)
- **Yellow pulsing dot**: Processing (encrypting/decrypting)

## Security Notes

### ✅ What's Safe

- Your password is **never stored** or sent anywhere
- Files are **never uploaded** to a server
- Encryption happens **only in your browser**
- You can **inspect the HTML/CSS/JS** - it's open source

### ⚠️ Best Practices

- Use **strong passwords** (8+ characters, mix of letters/numbers/symbols)
- **Remember your password** - it can't be recovered if lost
- Keep encrypted files **backed up** before deleting originals
- Test decrypt before deleting original files

### 🔒 How It Works

1. Password + Salt → **PBKDF2** → Encryption Key (256-bit)
2. Encryption Key + IV → **AES-GCM** → Encrypted File
3. Salt + IV + Encrypted Data → **Packed Binary** → `.enc` file

## Troubleshooting

### "No file selected"

**Solution**: Click file input and select a file before clicking encrypt/decrypt

### "Password must be at least 8 characters"

**Solution**: Enter a password with 8+ characters

### "Decryption failed: Incorrect password?"

**Solutions**:

- Check that password is exactly correct (case-sensitive)
- Verify you're using the correct encrypted file
- Try re-encrypting with new password

### "File appears to be corrupted or invalid"

**Solution**: The `.enc` file is corrupted or not encrypted with this app

### Browser shows blank page

**Solution**:

- Try opening in different browser
- Check browser console (F12) for errors
- Verify index.html path is correct

### Encryption is very slow

**Normal for large files**:

- 50MB file: 10-30 seconds
- 100MB file: 30-60 seconds
- Modern browsers have gotten faster in recent updates

## File Naming Convention

- **Original**: `document.pdf`
- **Encrypted**: `document.pdf.enc`
- **Decrypted**: `document.pdf` (automatically handled)

The app automatically adds/removes `.enc` extension based on operation.

## Advanced Usage

### Sharing Encrypted Files

1. **Share the `.enc` file** with anyone (via email, cloud storage, etc.)
2. **Securely tell them the password** (via phone, in-person, separate channel)
3. **They can decrypt** on their own computer using this app
4. **Only the `.enc` file** is transmitted - password never sent

### Backup Encrypted Files

```bash
# Keep encrypted copies with password knowledge
my-secure-files/
├── document.pdf.enc (password: "BackupPass123")
├── photo.jpg.enc (password: "PhotoPass456")
└── video.mp4.enc (password: "VideoPass789")
```

### Organizing Encrypted Archives

- Use separate passwords for different file categories
- Keep a **secure password manager** to track passwords
- Store `.enc` files in cloud (Google Drive, Dropbox, etc.)
- Password stays in your head

## Performance Expectations

| File Size | Operation | Time (Modern PC) |
| --------- | --------- | ---------------- |
| 1MB       | Encrypt   | <1 second        |
| 10MB      | Encrypt   | 1-2 seconds      |
| 50MB      | Encrypt   | 10-15 seconds    |
| 100MB     | Encrypt   | 30-60 seconds    |

Mobile devices may be slightly slower. Decryption is same speed as encryption.

## Limitations & Workarounds

| Limitation                      | Workaround                                            |
| ------------------------------- | ----------------------------------------------------- |
| Only one file at a time         | Drag to encrypt multiple files one-by-one             |
| No progress bar for large files | Time estimate: 1MB ≈ 0.1-0.2 seconds                  |
| No key derivation config        | Using security-standard parameters (can't change)     |
| No compression                  | File size may increase slightly with very small files |

## Browser Console (For Developers)

Open browser DevTools (F12) to:

- See error messages (without sensitive data)
- Check that all files loaded correctly
- Verify no password/key data is logged

```javascript
// You will see:
"Encryption failed: ..."; // Safe error messages
"Decryption error: ..."; // No sensitive details exposed

// You will NOT see:
// passwords, keys, or decrypted content
```

## Next Steps

1. **Test the app** with different files
2. **Share encrypted files** with friends
3. **Bookmark this page** for future use
4. **Review the code** - it's simple and auditable!
5. **Request features** or report bugs

---

**Remember: Your password is your only security. If you forget it, the file is gone forever.**
