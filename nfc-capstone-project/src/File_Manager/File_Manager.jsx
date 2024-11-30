import React, { useState, useEffect } from 'react';
import { collection, getDoc, addDoc, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage';
import { db, storage } from '../firebase-config';
import styles from './File_Manager.module.css'
import Buttons from '../Buttons/Button.module.css';
import { FolderIcon, FileIcon, Trash2, Edit2, Copy, Move, Upload, Plus, ChevronRight, ChevronDown, FolderTree } from 'lucide-react';

const FileManager = ({ currentUser, onClose }) => {
  const [folders, setFolders] = useState([]);
  const [allFolders, setAllFolders] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameItem, setRenameItem] = useState(null);
  const [newName, setNewName] = useState('');
  const [showFolderSelect, setShowFolderSelect] = useState(false);
  const [itemToMove, setItemToMove] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [actionType, setActionType] = useState(null); // 'move' or 'copy'
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const getSanitizedEmail = (email) => {
    return email.replace(/[@.]/g, '_');
  };

  useEffect(() => {
    if (currentUser) {
      fetchFolders();
    }
  }, [currentUser, currentPath]);

    // Fetch all folders on component mount
    useEffect(() => {
      if (currentUser) {
        fetchAllFolders();
      }
    }, [currentUser]);
  
    const fetchAllFolders = async () => {
      try {
        const sanitizedEmail = getSanitizedEmail(currentUser.email);
        const adminDocRef = doc(db, 'admin', currentUser.email);
        const adminDoc = await getDoc(adminDocRef);
    
        let foldersList = [];
        if (adminDoc.exists()) {
          const storedFolders = adminDoc.data().list_of_folders || [];
          
          foldersList = storedFolders
            .filter(path => {
              const pathParts = path.split('/');
              
              // Include all folders under the user's root
              return pathParts[0] === 'users' && 
                     pathParts[1] === sanitizedEmail;
            })
            .map(path => {
              const pathParts = path.split('/');
              const folderName = pathParts[pathParts.length - 1];
              
              // Determine parentPath more carefully
              const parentPath = pathParts.length > 3 
                ? pathParts.slice(0, -1).join('/') 
                : ''; // Root level folders have empty parentPath
    
              return {
                id: path,  // Use full path as ID for uniqueness
                name: folderName,
                path: path,
                type: 'folder',
                isCompleted: folderName === 'Completed_events',
                parentPath: parentPath,
                depth: pathParts.length - 2  // Depth relative to user's root
              };
            })
            .sort((a, b) => {
              // Sort Completed_events first, then alphabetically
              if (a.isCompleted && !b.isCompleted) return -1;
              if (!a.isCompleted && b.isCompleted) return 1;
              return a.name.localeCompare(b.name);
            });
        }
    
        console.log('Prepared Folders:', foldersList);
        setAllFolders(foldersList);
      } catch (err) {
        console.error('Error fetching all folders:', err);
        setError('Failed to fetch folders');
      }
    };

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const sanitizedEmail = getSanitizedEmail(currentUser.email);
      const adminDocRef = doc(db, 'admin', currentUser.email);
      const adminDoc = await getDoc(adminDocRef);
  
      let foldersList = [];
      if (adminDoc.exists()) {
        const storedFolders = adminDoc.data().list_of_folders || [];
        
        foldersList = storedFolders
          .filter(path => {
            const pathParts = path.split('/');
            const currentPathString = currentPath.join('/');
            
            // Special handling for Completed_events at root
            if (currentPath.length === 0) {
              // If at root level, show only immediate children of users/email/
              const isBaseFolder = pathParts[0] === 'users' && 
                                 pathParts[1] === sanitizedEmail &&
                                 pathParts.length === 3;
              return isBaseFolder;
            } else {
              // For nested navigation, show only immediate children of current path
              const isChildOfCurrentPath = path.startsWith(currentPathString + '/');
              const isDirectChild = path.split('/').length === currentPathString.split('/').length + 1;
              return isChildOfCurrentPath && isDirectChild;
            }
          })
          .map(path => {
            const folderName = path.split('/').pop();
            return {
              id: path,  // Use full path as ID for uniqueness
              name: folderName,
              path: path,
              type: 'folder',
              isCompleted: folderName === 'Completed_events',
              parentPath: path.split('/').slice(0, -1).join('/'),
              depth: path.split('/').length - 2  // Depth relative to user's root
            };
          })
          .sort((a, b) => {
            // Sort Completed_events first, then alphabetically
            if (a.isCompleted && !b.isCompleted) return -1;
            if (!a.isCompleted && b.isCompleted) return 1;
            return a.name.localeCompare(b.name);
          });
      }
    
      let filesList = [];
      if (adminDoc.exists()) {
        const filesTracking = adminDoc.data().files_tracking || {};
        const currentPathString = currentPath.join('/');
        
        const filePromises = Object.entries(filesTracking)
          .filter(([path]) => {
            const pathParts = path.split('/');
            const fileParentPath = pathParts.slice(0, -1).join('/');
            
            // Show files only when inside the Completed_events folder
            if (currentPath.length === 0) {
              // Don't show files at root level
              return false;
            } else if (currentPath[currentPath.length - 1] === 'Completed_events') {
              // Show files only when inside Completed_events folder
              return fileParentPath === `users/${sanitizedEmail}/Completed_events`;
            } else {
              // Show files in other subfolders if needed
              return fileParentPath === currentPathString;
            }
          })
          .map(async ([path, fileData]) => {
            try {
              const fileRef = ref(storage, path);
              const [url, metadata] = await Promise.all([
                getDownloadURL(fileRef),
                getMetadata(fileRef)
              ]);
              
              return {
                ...fileData,
                url,
                id: path,
                name: fileData.name,
                type: 'file',
                fileType: fileData.type || 'unknown',
                size: metadata.size || fileData.size,
                createdAt: metadata.timeCreated || fileData.createdAt,
                lastModified: metadata.updated || fileData.lastModified,
                downloadUrl: url,
                path,
                contentType: metadata.contentType
              };
            } catch (error) {
              console.error(`Error processing file ${path}:`, error);
              return null;
            }
          });
      
        const resolvedFiles = await Promise.all(filePromises);
        filesList = resolvedFiles
          .filter(file => file !== null)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
  
      setFolders([...foldersList, ...filesList]);
      setError(null);
    } catch (err) {
      setError('Failed to fetch folders and files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (item) => {
    setLoading(true);
    try {
      const adminDocRef = doc(db, 'admin', currentUser.email);
      const adminDoc = await getDoc(adminDocRef);
  
      if (item.type === 'file') {
        const sourceRef = ref(storage, item.path);
        const newPath = item.path || `${currentPath.join('/')}/${item.name}_copy`;
        const newRef = ref(storage, newPath);
        
        const response = await fetch(item.url);
        const blob = await response.blob();
        await uploadBytes(newRef, blob);
        const newUrl = await getDownloadURL(newRef);
  
        const filesTracking = adminDoc.data().files_tracking || {};
        filesTracking[newPath] = {
          name: `${item.name}_copy`,
          url: newUrl,
          type: 'file'
        };
  
        await updateDoc(adminDocRef, { files_tracking: filesTracking });
      } else {
        const sanitizedEmail = getSanitizedEmail(currentUser.email);
        const adminDocRef = doc(db, 'admin', sanitizedEmail);
        const adminDoc = await getDoc(adminDocRef);
        const storedFolders = adminDoc.data().list_of_folders || [];
        
        const newFolderPath = item.path || `${currentPath.join('/')}/${item.name}_copy`;
        const updatedFolders = [...storedFolders, newFolderPath];
  
        await updateDoc(adminDocRef, { list_of_folders: updatedFolders });
      }
  
      fetchFolders();
    } catch (err) {
      setError('Failed to copy item');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleMove = async (item, targetPath) => {
    setLoading(true);
    try {
      const sanitizedEmail = getSanitizedEmail(currentUser.email);
      const adminDocRef = doc(db, 'admin', sanitizedEmail);
      const adminDoc = await getDoc(adminDocRef);
  
      if (item.type === 'file') {
        const sourceRef = ref(storage, item.path);
        const newPath = `${targetPath}/${item.name}`;
        const newRef = ref(storage, newPath);
        
        const response = await fetch(item.url);
        const blob = await response.blob();
        await uploadBytes(newRef, blob);
        const newUrl = await getDownloadURL(newRef);
        await deleteObject(sourceRef);
  
        const filesTracking = adminDoc.data().files_tracking || {};
        delete filesTracking[item.path];
        filesTracking[newPath] = {
          name: item.name,
          url: newUrl,
          type: 'file'
        };
  
        await updateDoc(adminDocRef, { files_tracking: filesTracking });
      } else {
        const storedFolders = adminDoc.data().list_of_folders || [];
        const newFolders = storedFolders.map(path => {
          if (path.startsWith(item.path)) {
            return path.replace(item.path, `${targetPath}/${item.name}`);
          }
          return path;
        }).filter(path => path !== item.path);
  
        await updateDoc(adminDocRef, { list_of_folders: newFolders });
      }
  
      fetchFolders();
    } catch (err) {
      setError('Failed to move item');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveOrCopy = async (item, action) => {
    setItemToMove(item);
    setActionType(action);
    
    // Fetch folders if not already loaded
    if (allFolders.length === 0) {
      await fetchAllFolders();
    }
    
    setShowFolderSelect(true);
    setSelectedFolder(null);
  };

  const handleFolderSelect = (folder) => {
    setSelectedFolder(folder);
  };

  const toggleFolderExpand = (folderId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleActionConfirm = async () => {
    if (!selectedFolder) {
      setError('Please select a destination folder');
      return;
    }

    try {
      setLoading(true);
      
      // Update current path to the selected folder's path
      const destinationPath = selectedFolder.path.split('/');
      
      if (actionType === 'move') {
        await handleMove(itemToMove, selectedFolder.path);
      } else {
        // For copy, pass the updated current path
        const copyResult = await handleCopy({
          ...itemToMove,
          // Override the path with the selected folder's path
          path: `${selectedFolder.path}/${itemToMove.name}`
        });
      }
      
      setShowFolderSelect(false);
      setItemToMove(null);
      setSelectedFolder(null);
      setCurrentPath(destinationPath);
    } catch (err) {
      setError(`Failed to ${actionType} item`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const FolderTrees = ({ folders, parentPath = '', depth = 0 }) => {
    // Debug: Log the entire folders array and the current parentPath
    console.log('All Folders:', folders);
    console.log('Current Parent Path:', parentPath);
  
    const currentFolders = folders.filter(f => {
      // Debug: Log each folder's parentPath for inspection
      console.log(`Checking folder: ${f.name}, parentPath: ${f.parentPath}`);
      return f.parentPath === parentPath;
    });
  
    console.log('Current Folders:', currentFolders);
  
    return currentFolders.map(folder => {
      const hasChildren = folders.some(f => f.parentPath === folder.path);
      const isExpanded = expandedFolders.has(folder.id);
      const isSelected = selectedFolder?.id === folder.id;
      const cannotSelectSelf = itemToMove?.path === folder.path;
      const isChildOfMovedItem = itemToMove?.type === 'folder' && folder.path.startsWith(itemToMove.path);
  
      return (
        <div key={folder.id} style={{ marginLeft: `${depth * 20}px` }}>
          <div 
            className={`${styles.folderSelectItem} ${isSelected ? styles.selected : ''} ${(cannotSelectSelf || isChildOfMovedItem) ? styles.disabled : ''}`}
          >
            <button 
              className={styles.expandButton}
              onClick={() => toggleFolderExpand(folder.id)}
              style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div 
              className={styles.folderSelectName}
              onClick={() => !cannotSelectSelf && !isChildOfMovedItem && handleFolderSelect(folder)}
            >
              <FolderIcon size={16} />
              <span>{folder.name}</span>
            </div>
          </div>
          {isExpanded && hasChildren && (
            <FolderTrees 
              folders={folders}
              parentPath={folder.path}
              depth={depth + 1}
            />
          )}
        </div>
      );
    });
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    setLoading(true);
    
    try {
      // const sanitizedEmail = getSanitizedEmail(currentUser.email);
      const adminDocRef = doc(db, 'admin', currentUser.email);
      const adminDoc = await getDoc(adminDocRef);
      const filesTracking = adminDoc.data().files_tracking || {};
  
      for (const file of files) {
        const filePath = `${currentPath.join('/')}/${file.name}`;
        const storageRef = ref(storage, filePath);
        
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        filesTracking[filePath] = {
          name: file.name,
          url,
          type: 'file'
        };
      }
  
      await updateDoc(adminDocRef, { files_tracking: filesTracking });
      fetchFolders();
    } catch (err) {
      setError('Failed to upload files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createNewFolder = async () => {
    if (!newFolderName.trim() || !currentUser) {
      setError("Please enter a valid folder name and ensure you're logged in");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user's sanitized email for storage path
      const userEmail = currentUser.email;
      const sanitizedEmail = userEmail.replace(/[.@]/g, '_');
      
      // Construct the new folder path
      const basePath = `users/${sanitizedEmail}`;
      const currentPathString = currentPath.join('/');
      const newFolderPath = currentPathString 
        ? `${currentPathString}/${newFolderName}` 
        : `${basePath}/${newFolderName}`;

      // Create placeholder file in the new folder
      const placeholderRef = ref(storage, `${newFolderPath}/.placeholder`);
      const emptyBlob = new Blob([''], { type: 'text/plain' });
      await uploadBytes(placeholderRef, emptyBlob);

      // Save folder to Firestore
      const adminDocRef = doc(db, 'admin', userEmail);
      const adminDoc = await getDoc(adminDocRef);
      
      if (adminDoc.exists()) {
        const existingFolders = adminDoc.data().list_of_folders || [];
        if (!existingFolders.includes(newFolderPath)) {
          await updateDoc(adminDocRef, {
            list_of_folders: [...existingFolders, newFolderPath]
          });
        }
      } else {
        await setDoc(adminDocRef, {
          list_of_folders: [newFolderPath]
        });
      }

      // Get existing files_tracking or initialize empty object
      const existingFilesTracking = adminDoc.exists() ? (adminDoc.data().files_tracking || {}) : {};
      
      // Add placeholder tracking data
      const placeholderPath = `${newFolderPath}/.placeholder`;
      const placeholderData = {
        name: '.placeholder',
        type: 'placeholder',
        size: 0,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      // Update admin document with placeholder tracking
      await updateDoc(adminDocRef, {
        files_tracking: {
          ...existingFilesTracking,
          [placeholderPath]: placeholderData
        }
      });

      // Reset UI state
      setNewFolderName('');
      setShowNewFolderInput(false);
      
      // Refresh folders list
      fetchFolders();

    } catch (error) {
      console.error("Error creating folder:", error);
      setError("Failed to create folder. Please try again.");
    } finally {
      setLoading(false);
    }
};

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete ${item.name}?`)) return;

    setLoading(true);
    try {
      // const sanitizedEmail = getSanitizedEmail(currentUser.email);
      const adminDocRef = doc(db, 'admin', currentUser.email);
      const adminDoc = await getDoc(adminDocRef);

      if (item.type === 'file') {
        const storageRef = ref(storage, item.path);
        await deleteObject(storageRef);

        const filesTracking = adminDoc.data().files_tracking || {};
        delete filesTracking[item.path];
        await updateDoc(adminDocRef, { files_tracking: filesTracking });
      } else {
        const storedFolders = adminDoc.data().list_of_folders || [];
        const updatedFolders = storedFolders.filter(path => !path.startsWith(item.path));
        await updateDoc(adminDocRef, { list_of_folders: updatedFolders });
      }

      fetchFolders();
    } catch (err) {
      setError('Failed to delete item');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (item) => {
    if (!newName.trim()) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'folders', item.id), {
        name: newName
      });
      setRenameItem(null);
      setNewName('');
      fetchFolders();
    } catch (err) {
      setError('Failed to rename item');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folder) => {
    setCurrentPath([...currentPath, folder.name]);
  };

  const navigateBack = () => {
    setCurrentPath(currentPath.slice(0, -1));
  };

  return (
    <div className={styles.fileManager}>
      <div className={styles.header}>
        <h2>File Manager</h2>
        <button className={styles.closeButton} onClick={onClose}>×</button>
      </div>

      <div className={styles.toolbar}>
        <input
          type="file"
          id="fileUpload"
          className={styles.fileInput}
          onChange={handleFileUpload}
          hidden
        />
        <label htmlFor="fileUpload" 
        className={`${Buttons.event_buttons} ${Buttons.upload_file}`}>
          <Upload size={20} />
          Upload File
        </label>

        {currentPath.length === 0 && (
          <button 
            className={`${Buttons.event_buttons} ${Buttons.new_folder}`}
            onClick={() => setShowNewFolderInput(true)}
          >
            <Plus size={20} />
            New Folder
          </button>
        )}
      </div>

      {showNewFolderInput && (
        <div className={styles.newFolderInput}>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
          />
          <button onClick={createNewFolder}
          className={`${Buttons.event_buttons} ${Buttons.create}`}>Create</button>
          <button onClick={() => setShowNewFolderInput(false)}

          className={`${Buttons.event_buttons} ${Buttons.cancel}`}>Cancel</button>
        </div>
      )}

      <div className={styles.breadcrumb}>
        {currentPath.length > 0 && (
          <button onClick={navigateBack}>← Back</button>
        )}
        <span>/{currentPath.join('/')}</span>
      </div>

      {loading && <div className={styles.loading}>Loading...</div>}
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.content}>
        {folders.map(item => (
          <div key={item.id} className={styles.item}>
            {item.type === 'folder' ? (
              <div className={styles.folder} onClick={() => navigateToFolder(item)}>
                <FolderIcon size={24} />
                {renameItem?.id === item.id ? (
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={() => handleRename(item)}
                    autoFocus
                  />
                ) : (
                  <span>{item.name}</span>
                )}
              </div>
            ) : (
              <div className={styles.file}>
                <FileIcon size={24} />
                {renameItem?.id === item.id ? (
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={() => handleRename(item)}
                    autoFocus
                  />
                ) : (
                  <span>{item.name}</span>
                )}
              </div>
            )}

            <div className={styles.actions}>
              <button onClick={() => setRenameItem(item)} title="Rename">
                <Edit2 size={16} />
              </button>
              <button onClick={() => handleMoveOrCopy(item, 'copy')} title="Copy">
                <Copy size={16} />
              </button>
              <button onClick={() => handleMoveOrCopy(item, 'move')} title="Move">
                <Move size={16} />
              </button>
              <button onClick={() => handleDelete(item)} title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showFolderSelect && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{actionType === 'move' ? 'Move' : 'Copy'} {itemToMove?.name}</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowFolderSelect(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.folderSelectContainer}>
              <h4>Select destination folder:</h4>
              <div className={styles.folderTree}>
                <FolderTrees folders={allFolders} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.button}
                onClick={handleActionConfirm}
                disabled={!selectedFolder}
              >
                {actionType === 'move' ? 'Move' : 'Copy'}
              </button>
              <button 
                className={styles.button}
                onClick={() => setShowFolderSelect(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default FileManager;