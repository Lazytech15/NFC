import styles from './Dashboard.module.css';
import AddStudentForm from '../Add_student/Addstudent_form.jsx';
import FileManager from '../File_Manager/File_Manager.jsx';
import AddEventForm from '../Add_event/Add_event_form.jsx';
import Buttons from '../Buttons/Button.module.css';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileIcon, FolderIcon, X, Plus, Edit2, Trash2, Save, XCircle, Loader,
  Search, Download, Filter, SortAsc, SortDesc, CheckSquare, FileArchive, Pickaxe 
} from 'lucide-react';

import { collection, getDocs, getDoc, addDoc, deleteDoc, doc, updateDoc, setDoc, query, where, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  db, storage, getAuth, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  deleteUser
} from '../firebase-config.jsx';
import ProgressDisplay from '../Progress_display/Progress_display.jsx';
import * as XLSX from 'xlsx';

const VALID_STATUS = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
const DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

const Dashboard = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [sheetData, setSheetData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nothing, setnothing] = useState(false);
  const [error, setError] = useState(null);
  const [newEventName, setNewEventName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({ status: 'all' });
  const [selectedItems, setSelectedItems] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showProgressDisplay, setShowProgressDisplay] = useState(false);
  const [archivedFiles, setArchivedFiles] = useState([]);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [archiveData, setArchiveData] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [filemanager, setfilemanager] = useState(false);
  
  
  // Fetch main event records
  useEffect(() => {
    // Listen for auth state changes
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      if (user) {
        fetchEventRecords(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);


// search

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let result = [...files];
    
    // Search
    if (searchTerm) {
      result = result.filter(file => 
        file.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter(file => file.status === filters.status);
    }

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [files, searchTerm, sortConfig, filters]);

  // Export functionality
  const handleExport = async () => {
    if (selectedItems.length === 0 || !currentUser) {
      setError("Please select items to export and ensure you're logged in");
      return;
    }
  
    setLoading(true);
    setError(null);
  
    try {
      // Get user's sanitized email for storage path
      const userEmail = currentUser.email;
      const sanitizedEmail = userEmail.replace(/[.@]/g, '_');
      
      // Create the exports folder structure with placeholder
      const exportsFolderPath = `users/${sanitizedEmail}/Completed_events`;
      const placeholderRef = ref(storage, `${exportsFolderPath}/.placeholder`);
      const emptyBlob = new Blob([''], { type: 'text/plain' });
      await uploadBytes(placeholderRef, emptyBlob);

      // Save Completed_events folder to Firestore
      const adminDocRef = doc(db, 'admin', userEmail);
      const adminDoc = await getDoc(adminDocRef);
      
      if (adminDoc.exists()) {
        const existingFolders = adminDoc.data().list_of_folders || [];
        if (!existingFolders.includes(exportsFolderPath)) {
          await updateDoc(adminDocRef, {
            list_of_folders: [...existingFolders, exportsFolderPath]
          });
        }
      } else {
        await setDoc(adminDocRef, {
          list_of_folders: [exportsFolderPath]
        });
      }
  
      // Process the export data
      const exportData = [];
      const batch = writeBatch(db);
      const currentDate = new Date().toLocaleDateString();
  
      // Gather data from selected items
      for (const fileId of selectedItems) {
        const fileDetails = files.find(f => f.id === fileId);
        
        if (fileDetails && fileDetails.createdBy === currentUser.uid) {
          const dataCollectionRef = collection(db, fileId);
          const querySnapshot = await getDocs(dataCollectionRef);
          
          querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            exportData.push({
              'Event Name': fileDetails.event_name,
              'Control ID': fileId,
              'Status': 'Completed',
              'Student Number': doc.id,
              'Student Name': data.Student_name || '',
              'Course': data.course || '',
              'Campus': data.campus || '',
              'Date': data.date || currentDate
            });
          });
  
          // Delete collection documents
          const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
  
          // Add to completed events
          await addDoc(collection(db, 'event_completed'), {
            Control_id: fileId,
            Event_name: fileDetails.event_name,
            Status: 'Completed',
            exportDate: currentDate,
            userId: currentUser.uid,
            timestamp: new Date().toISOString()
          });
  
          // Queue original event for deletion
          const eventRef = doc(db, 'event_record', fileId);
          batch.delete(eventRef);
        }
      }
  
      // Create Excel file
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Completed Events');
      
      const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const buffer = new Uint8Array(wbout);
  
      // Generate filename
      const firstEvent = files.find(f => f.id === selectedItems[0]);
      const sanitizedEventName = firstEvent.event_name.replace(/[^a-zA-Z0-9]/g, '_');
      const currentDates = new Date().toLocaleDateString().replace(/\//g, '-');
      const filename = `${sanitizedEventName}_${firstEvent.id}_${currentDates}.xlsx`;
      
      // Create storage reference and upload
      const storagePath = `${exportsFolderPath}/${filename}`;
      const storageRef = ref(storage, storagePath);
      
      // Upload the Excel file
      const uploadResult = await uploadBytes(storageRef, buffer);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      // Get existing files_tracking or initialize empty object
      const existingFilesTracking = adminDoc.exists() ? (adminDoc.data().files_tracking || {}) : {};
      
      // Add new file tracking data
      const fileTrackingData = {
        name: filename,
        type: 'xlsx',
        size: buffer.length,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        eventIds: selectedItems,
        downloadURL: downloadURL
      };

      // Update admin document with new file tracking
      await updateDoc(adminDocRef, {
        files_tracking: {
          ...existingFilesTracking,
          [storagePath]: fileTrackingData
        }
      });
  
      // Update completed events with storage info
      const completedEventsQuery = query(
        collection(db, 'event_completed'),
        where('userId', '==', currentUser.uid),
        where('Control_id', 'in', selectedItems)
      );
      
      const completedDocs = await getDocs(completedEventsQuery);
      const updatePromises = completedDocs.docs.map(doc => 
        updateDoc(doc.ref, { 
          Storage_path: downloadURL,
          file_path: storagePath
        })
      );
      await Promise.all(updatePromises);
  
      // Commit the batch deletion
      await batch.commit();
      
      // Update UI state
      setFiles(files.filter(file => !selectedItems.includes(file.id)));
      setSelectedItems([]);
      
      // Refresh archive if needed
      if (showArchive) {
        fetchArchivedFiles();
      }
  
      // Trigger download
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
  
    } catch (error) {
      console.error("Error in export process:", error);
      setError("Failed to export and archive data. Please try again.");
    } finally {
      setLoading(false);
    }
};


  // Bulk delete functionality
  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.length} items?`)) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const batch = writeBatch(db);
      
      selectedItems.forEach(id => {
        const docRef = doc(db, 'event_record', id);
        batch.delete(docRef);
      });

      await batch.commit();
      
      setFiles(files.filter(file => !selectedItems.includes(file.id)));
      setSelectedItems([]);
    } catch (error) {
      setError("Failed to delete items. Please try again.");
      console.error("Error in bulk delete:", error);
    } finally {
      setLoading(false);
    }
  };

//   end here

const fetchEventRecords = async (userId) => {
  setLoading(true);
  setError(null);
  try {
    const eventCollectionRef = collection(db, 'event_record');
    const userEventsQuery = query(eventCollectionRef, where('createdBy', '==', userId));
    const eventSnapshot = await getDocs(userEventsQuery);
    const eventList = eventSnapshot.docs.map(doc => ({
      id: doc.id,
      event_name: doc.data().event_name,
      status: doc.data().status || 'Pending',
      createdBy: doc.data().createdBy
    }));
    setFiles(eventList);
    setnothing(eventList.length === 0);
  } catch (error) {
    setError("Failed to fetch event records. Please try again later.");
    console.error("Error fetching event records:", error);
  } finally {
    setLoading(false);
  }
};


  const handleStatusChange = async (fileId, newStatus) => {
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, 'event_record', fileId);
      await updateDoc(docRef, {
        status: newStatus
      });
      
      setFiles(files.map(file => 
        file.id === fileId 
          ? { ...file, status: newStatus }
          : file
      ));
    } catch (error) {
      setError("Failed to update status. Please try again.");
      console.error("Error updating status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSheet = () => {
    setSelectedFile(null);
  };

  const handleFileClick = async (file) => {
    setLoading(true);
    setError(null);
    try {
      setSelectedFile(file);
      
      // Get reference to the collection
      const dataCollectionRef = collection(db, file.id);
      const querySnapshot = await getDocs(dataCollectionRef);
      
      // Updated headers with new column
      const headers = ['', 'Student Number', 'Student Name', 'Course', 'Campus', 'Date', 'Actions'];
      
      // Map documents to rows with new column
      const rows = querySnapshot.docs.map((doc, index) => {
        const data = doc.data();
        return [
          (index + 1).toString(), // Row number
          doc.id, // Using document ID as Student Number
          data.Student_name || '',
          data.course || '', 
          data.campus || '',
          data.date || new Date().toLocaleDateString(),
          'actions'
        ];
      });
  
      // Combine headers with rows
      setSheetData([headers, ...rows]);
      
    } catch (error) {
      setError("Failed to fetch sheet data. Please try again later.");
      console.error("Error fetching sheet data:", error);
    } finally {
      setLoading(false);
    }
  };
  

  const handleAddNewFile = async () => {
    if (!newEventName.trim() || !currentUser) {
      setError("Event name cannot be empty or user not logged in");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const eventCollectionRef = collection(db, 'event_record');
      const newDoc = await addDoc(eventCollectionRef, {
        event_name: newEventName,
        status: 'Pending',
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString()
      });
      setFiles([...files, { 
        id: newDoc.id, 
        event_name: newEventName,
        status: 'Pending',
        createdBy: currentUser.uid
      }]);
      setNewEventName('');
      setnothing(false);
      setIsAddingNew(false);
    } catch (error) {
      setError("Failed to create new event. Please try again.");
      console.error("Error adding new event:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
  
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'event_record', fileId));
      const updatedFiles = files.filter(file => file.id !== fileId);
      setFiles(updatedFiles);
      setnothing(updatedFiles.length === 0);
    } catch (error) {
      setError("Failed to delete event. Please try again.");
      console.error("Error deleting event:", error);
    } finally {
      setLoading(false);
    }
  };
  

  const handleAddNewRow = async (studentData) => {
    setLoading(true);
    setError(null);
    try {
      // Create a new document with the provided student number
      const docRef = doc(db, selectedFile.id, studentData.studentNumber);
      await setDoc(docRef, {
        Student_name: studentData.studentName,
        course: studentData.studentCourse,     
        campus: studentData.studentCampus,     
        date: studentData.date
      });
  
      const newRow = [
        (sheetData.length).toString(),
        studentData.studentNumber,
        studentData.studentName,
        studentData.studentCourse,           
        studentData.studentCampus,            
        studentData.date,
        'actions'
      ];
  
      setSheetData([...sheetData, newRow]);
      setShowAddForm(false);
    } catch (error) {
      setError("Failed to add new row. Please try again.");
      console.error("Error adding new row:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderCell = (cell, rowIndex, cellIndex) => {
    // Render table header
    if (rowIndex === 0) {
      const headerText = cellIndex === 0 ? '#' : cell;
      return <th className={styles.Sheet_header}>{headerText}</th>;
    }
  
    // Render actions column (now at index 6 due to new columns)
    if (cellIndex === 6) {
      return (
        <div className={Buttons.buttons}>
          {editingRow === rowIndex ? (
            <button
              className={styles.save_button}
              onClick={() => handleSaveRow(rowIndex)}
            >
              <Save size={16} />
            </button>
          ) : (
            <button
              className={styles.edit_button}
              onClick={() => handleEditRow(rowIndex)}
            >
              <Edit2 size={16} />
            </button>
          )}
          <button
            className={styles.delete_button}
            onClick={() => handleDeleteRow(rowIndex)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      );
    }
  
    // Show input fields when editing
    if (editingRow === rowIndex && cellIndex > 0 && cellIndex < 6) {
      const fieldName = cellIndex === 1 ? 'studentNumber' : 
                       cellIndex === 2 ? 'studentName' :
                       cellIndex === 3 ? 'course' :
                       cellIndex === 4 ? 'campus' : 'date';
      
      return (
        <input
          type="text"
          value={editedData[fieldName] || ''}
          onChange={(e) => setEditedData({
            ...editedData,
            [fieldName]: e.target.value
          })}
          className={styles.edit_input}
        />
      );
    }
  
    // Regular cell content
    return cell;
  };

  const handleDeleteRow = async (rowIndex) => {
    if (!window.confirm("Are you sure you want to delete this row?")) return;
    
    setLoading(true);
    setError(null);
    try {
      const studentNumber = sheetData[rowIndex][1];
      await deleteDoc(doc(db, selectedFile.id, studentNumber));
      
      // Remove the row and update row numbers
      const newSheetData = [
        sheetData[0], // Keep headers
        ...sheetData.slice(1) // Get all rows except header
          .filter((_, index) => index !== rowIndex - 1) // Remove deleted row
          .map((row, index) => [ // Update row numbers
            (index + 1).toString(),
            ...row.slice(1)
          ])
      ];
      
      setSheetData(newSheetData);
    } catch (error) {
      setError("Failed to delete row. Please try again.");
      console.error("Error deleting row:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRow = (rowIndex) => {
    setEditingRow(rowIndex);
    setEditedData({
      studentNumber: sheetData[rowIndex][1],
      studentName: sheetData[rowIndex][2],
      course: sheetData[rowIndex][3],     
      campus: sheetData[rowIndex][4],     
      date: sheetData[rowIndex][5]
    });
  };

  const handleSaveRow = async (rowIndex) => {
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, selectedFile.id, editedData.studentNumber);
      await updateDoc(docRef, {
        Student_name: editedData.studentName,
        course: editedData.course,      
        campus: editedData.campus,         
        date: editedData.date
      });
  
      const newSheetData = [...sheetData];
      newSheetData[rowIndex] = [
        rowIndex.toString(),
        editedData.studentNumber,
        editedData.studentName,
        editedData.course,                
        editedData.campus,                
        editedData.date,
        'actions'
      ];
      setSheetData(newSheetData);
      setEditingRow(null);
      setEditedData({});
    } catch (error) {
      setError("Failed to save changes. Please try again.");
      console.error("Error saving row:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch archived files
  const fetchArchivedFiles = async () => {
    if (!currentUser) {
      setError("Please log in to view archived files");
      return;
    }
    
    setLoading(true);
    setError(null); // Clear any existing errors
    try {
      const archiveCollectionRef = collection(db, 'event_completed');
      const userArchivesQuery = query(
        archiveCollectionRef, 
        where('userId', '==', currentUser.uid)
      );
      
      const archiveSnapshot = await getDocs(userArchivesQuery);
      const archives = archiveSnapshot.docs
        .filter(doc => doc.data().Storage_path) 
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp || new Date().toISOString()
        }));
      
      setArchivedFiles(archives);
      
      // Only set error if specifically looking at archives and none found
      if (archives.length === 0 && showArchive) {
        setError("No archived files found");
      }
    } catch (error) {
      console.error("Error fetching archives:", error);
      setError("Failed to fetch archived files. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle archive file selection
  const handleArchiveClick = async (archive) => {
    if (!archive || !currentUser) {
      setError("Archive not found or user not authenticated");
      return;
    }
  
    setLoading(true);
    setError(null);
  
    try {
      // Get the storage reference
      const storageRef = ref(storage, archive.file_path);
      
      try {
        // Try to get the file from storage first
        const url = await getDownloadURL(storageRef);
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch archive file');
        }
        
        const blob = await response.blob();
  
        // Create a promise to handle FileReader
        const readFileData = () => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
              try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get the first sheet
                const firstSheetName = workbook.SheetNames[0];
                const firstSheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON with error handling
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
                  header: 1,
                  defval: '' // Default value for empty cells
                });
  
                // Validate data structure
                if (!Array.isArray(jsonData) || jsonData.length === 0) {
                  throw new Error('Invalid file format or empty file');
                }
  
                // Format data for display
                const headers = ['#', ...jsonData[0].map(header => header || 'Unnamed Column')];
                const rows = jsonData.slice(1).map((row, index) => [
                  (index + 1).toString(),
                  ...row.map(cell => cell ?? '') // Handle null/undefined values
                ]);
  
                resolve([headers, ...rows]);
              } catch (error) {
                reject(new Error('Failed to parse Excel file: ' + error.message));
              }
            };
  
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(blob);
          });
        };
  
        // Process the file data
        const formattedData = await readFileData();
        
        // Update state with the processed data
        setArchiveData(formattedData);
        setSelectedArchive({
          ...archive,
          lastAccessed: new Date().toISOString()
        });
  
        // Optionally update last accessed timestamp in database
        try {
          const archiveRef = doc(db, 'event_completed', archive.id);
          await updateDoc(archiveRef, {
            lastAccessed: new Date().toISOString()
          });
        } catch (dbError) {
          console.warn('Failed to update last accessed timestamp:', dbError);
          // Non-critical error, don't throw
        }
  
      } catch (storageError) {
        // If storage fetch fails, try fallback to Storage_path URL
        console.warn('Failed to fetch from storage, trying fallback URL:', storageError);
        
        const response = await fetch(archive.Storage_path);
        if (!response.ok) {
          throw new Error('Failed to fetch archive file from both storage and fallback URL');
        }
        
        const blob = await response.blob();
        const formattedData = await readFileData();
        
        setArchiveData(formattedData);
        setSelectedArchive({
          ...archive,
          lastAccessed: new Date().toISOString()
        });
      }
  
    } catch (error) {
      console.error("Error in handleArchiveClick:", error);
      setError(`Failed to load archived file: ${error.message}`);
      setArchiveData([]);
      setSelectedArchive(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => { 
    const auth = getAuth(); 
    try { 
      await signOut(auth); console.log('User signed out successfully'); 
    } catch (error) { 
      console.error('Error signing out:', error); 
    } 
  };

  return (

    <>
    <div className={styles.main_container}>
        <div className={styles.aside_container}>

            {/* Add user info display */}
            {currentUser && (
              <div className={styles.user_info}>
                <img src={currentUser.photoURL || "src/assets/icons/user_profile.png"} alt="Profile" />
                <p>{currentUser.email}</p>
              </div>
            )}

            <div className={styles.event_button_container}>
              {/* add event Bar */}
              <div className={styles.Header_content}>
                  {!selectedFile && (
                    <button
                      className={`${Buttons.event_buttons} ${Buttons.new_event}`}
                      onClick={() => setIsAddingNew(true)}
                    >
                      <Plus size={20} />
                      Add New Event
                    </button>
                )}
            </div>
            
            {/* completed event Bar */}
            <div className={styles.Header_content}>
            {!selectedFile && (
                <button
                  className={`${Buttons.event_buttons} ${Buttons.archive}`}
                  onClick={() => {
                    setShowArchive(!showArchive);
                    if (!showArchive) {
                      fetchArchivedFiles();
                    }
                  }}
                >
                  <FileArchive size={20} />
                  {showArchive ? 'Show Active Events' : 'Completed Events'}
                </button>
              )}
            </div>

            {/* Display attendance */}
            <div className={styles.Header_content}>
            {!selectedFile && (
                <button
                className={`${Buttons.event_buttons} ${Buttons.progress}`}
                onClick={() => setShowProgressDisplay(!showProgressDisplay)}
              >
                <Pickaxe size={20} />
                {showProgressDisplay ? 'Hide Progress' : 'Show Progress'}
              </button>
              )}
            </div>

            {/* File Manager */}
            <div className={styles.Header_content}>
                <button
                    className={`${Buttons.event_buttons} ${Buttons.filemanager}`}
                    onClick={() => setfilemanager(!filemanager)}
                >
                    <FolderIcon size={20} />
                    File Manager
                </button>
            </div>

            {/* Log out */}
            <div className={styles.logout_container}>
                <button
                    className={`${Buttons.event_buttons} ${Buttons.logout}`}
                    onClick={handleSignOut}
                  >
                    <Filter size={20} />
                    Logout
                </button>
              </div>
              
          </div>
        </div>

        <div className={styles.Header_container}>

          {/* Error Display */}
          {error && (
            <div className={styles.error_container}>
              <p>{error}</p>
              <XCircle size={20} onClick={() => setError(null)} />
            </div>
          )}

          {/* Search and Filter Bar
          <div className={styles.toolbar}>
            <div className={styles.search_container}>
              <Search size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search files..."
                className={styles.search_input}
              />
            </div>

            <button
              className={styles.filter_button}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={20} />
              Filters
            </button>

            {selectedItems.length > 0 && (
              <>
                <button
                  className={styles.export_button}
                  onClick={handleExport}
                >
                  <Download size={20} />
                  Export Selected
                </button>

                <button
                  className={styles.delete_button}
                  onClick={handleBulkDelete}
                >
                  <Trash2 size={20} />
                  Delete Selected ({selectedItems.length})
                </button>
              </>
            )}
          </div>

          Filter Panel
          {showFilters && (
            <div className={styles.filter_panel}>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="all">All Status</option>
                {VALID_STATUS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          )} */}

          {/* Add New Event Form */}
          {isAddingNew && (
            <AddEventForm
              onSubmit={async (formData) => {
                setLoading(true);
                setError(null);
                try {
                  const eventCollectionRef = collection(db, 'event_record');
                  const newDoc = await addDoc(eventCollectionRef, {
                    event_name: formData.eventName,
                    location: formData.location,
                    description: formData.description,
                    status: 'Pending',
                    createdBy: currentUser.uid,
                    createdAt: new Date().toISOString()
                  });
                  
                  setFiles([...files, {
                    id: newDoc.id,
                    event_name: formData.eventName,
                    location: formData.location,
                    description: formData.description,
                    status: 'Pending',
                    createdBy: currentUser.uid
                  }]);
                  
                  setnothing(false);
                  setIsAddingNew(false);
                } catch (error) {
                  setError("Failed to create new event. Please try again.");
                  console.error("Error adding new event:", error);
                } finally {
                  setLoading(false);
                }
              }}
              onCancel={() => setIsAddingNew(false)}
            />
          )}

          {/* Main Content */}
          <div className={styles.File_container}>
          {loading ? (
            <div className={styles.loading_container}>
              <Loader size={40} className={styles.spinner} />
              <p>Loading...</p>
            </div>
          ) : showArchive ? (
            // Archive View
            !selectedArchive ? (
              <div className={styles.File_content}>
                 {archivedFiles && archivedFiles.length > 0 ? (
                    archivedFiles?.map((archive) => (
                  <div
                    key={archive.id}
                    className={styles.Filebar_container}
                    onClick={() => handleArchiveClick(archive)}
                  >
                    <div className={styles.Filebar_content}>
                      <FileIcon size={24} />
                      <div className={styles.Filebar_info}>
                        <p>Event Name: {archive.Event_name}</p>
                        <p>Control ID: {archive.Control_id}</p>
                        <p>Archived: {new Date(archive.timestamp).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div className={styles.nothing_here}>
                <img src="src/assets/icons/empty_icon.png" alt="" /> 
                <p>No archived events found</p>
              </div>
            )}
          </div>
        ) : (
              // Archive Sheet View
              <div className={styles.Sheet_container}>
                <div className={styles.headclose_container}>
                  <h2>{selectedArchive.Event_name} (Archived)</h2>
                  <button
                    className={`${Buttons.event_buttons} ${Buttons.close}`}
                    onClick={() => setSelectedArchive(null)}
                  >
                    <X size={20} />
                    Close
                  </button>
                </div>
                <div className={styles.Sheet_content}>
                  <table className={styles.Sheet_table}>
                    <thead>
                      <tr>
                        {archiveData[0]?.map((cell, index) => (
                          <th key={index} className={styles.Sheet_header}>
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {archiveData.slice(1).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className={styles.Sheet_item}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : showProgressDisplay ? (
            <ProgressDisplay 
              currentUser={currentUser}
              onClose={() => setShowProgressDisplay(false)}
            />
          ) : !selectedFile ? (
            // Regular file view (your existing code)
            <div className={styles.File_content}>
              {filteredData && filteredData.length > 0 ? (
                filteredData?.map((file) => (
                <div
                  key={file.id}
                  className={`${styles.Filebar_container} ${
                    selectedItems.includes(file.id) ? styles.selected : ''
                  }`}
                >
                  <div className={styles.file_select}>
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(file.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems([...selectedItems, file.id]);
                        } else {
                          setSelectedItems(selectedItems.filter(id => id !== file.id));
                        }
                      }}
                    />
                  </div>

                  <div 
                    className={styles.Filebar_content}
                    onClick={() => handleFileClick(file)}
                  >
                    <FileIcon size={24} />
                    <div className={styles.Filebar_info}>
                      <p>Event Name: {file.event_name}</p>
                      <p>Control ID: {file.id}</p>
                    </div>
                  </div>

                  <div className={styles.file_actions}>
                    <select
                      value={file.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(file.id, e.target.value);
                      }}
                      className={styles.status_select}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {VALID_STATUS.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSortConfig({
                          key: 'event_name',
                          direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
                        });
                      }}
                    >
                      {sortConfig.direction === 'asc' ? <SortAsc size={20} /> : <SortDesc size={20} />}
                    </button>
                    <Trash2 
                      size={20} 
                      className={styles.delete_icon}
                      onClick={() => handleDeleteFile(file.id)}
                    />
                  </div>
                </div>
              ))
          ) : (
            <div className={styles.nothing_here}>
              <img src="src/assets/icons/empty_icon.png" alt="" /> 
              <p>No active events found</p>
            </div>
          )}
        </div>
      ) : (
            // Sheet view
            <div className={styles.Sheet_container}>
              <div className={styles.headclose_container}>
                <h2>{selectedFile.event_name}</h2>
                <div className={styles.sheet_actions}>
                  <button onClick={() => setShowAddForm(true)}
                    className={`${Buttons.event_buttons} ${Buttons.add_row}`}>
                    <Plus size={20} />
                    Add Row
                  </button>
                  <button onClick={() => handleCloseSheet()}
                    className={`${Buttons.event_buttons} ${Buttons.close}`}>
                    <X size={20} />
                    Close
                  </button>
                  {showAddForm && (
                    <AddStudentForm
                      onSubmit={handleAddNewRow}
                      onCancel={() => setShowAddForm(false)}
                    />
                  )}
                </div>
              </div>

              <div className={styles.Sheet_content}>
                <table className={styles.Sheet_table}>
                  <thead>
                    <tr>
                      {sheetData[0]?.map((cell, cellIndex) => (
                        <th key={cellIndex} className={styles.Sheet_header}>
                          {cellIndex === 0 ? '#' : cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheetData.slice(1).map((row, rowIndex) => (
                      <tr 
                        key={rowIndex + 1}
                        className={editingRow === rowIndex + 1 ? styles.editing_row : ''}
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={styles.Sheet_item}
                          >
                            {renderCell(cell, rowIndex + 1, cellIndex)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        </div>
        {filemanager && (
          <div className={styles.fmodal_overlay}>
            <FileManager
              currentUser={currentUser}
              onClose={() => {
                setfilemanager(false); 
              }}
            />
          </div>
        )}
        </div>
    </>
    

    
  );
};

export default Dashboard;