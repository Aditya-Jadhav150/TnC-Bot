import os
import zipfile

def zip_extension():
    zip_filename = 'extension.zip'
    source_dir = 'extension'
    
    if not os.path.exists(source_dir):
        print(f"Error: '{source_dir}' directory not found. Make sure to run this script from the workspace root.")
        return
        
    print(f"Creating {zip_filename}...")
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                # Exclude python helper scripts from the final zip
                if file.endswith('.py'):
                    continue
                file_path = os.path.join(root, file)
                # Compute the relative archive name so it extracts into an 'extension/' directory
                arcname = os.path.relpath(file_path, start=os.path.dirname(source_dir))
                zipf.write(file_path, arcname)
                print(f"  Added: {arcname}")
                
    print(f"\nSuccess! '{zip_filename}' has been created in your workspace root.")

if __name__ == '__main__':
    zip_extension()
