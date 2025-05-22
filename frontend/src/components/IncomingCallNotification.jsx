import toast from 'react-hot-toast';

const IncomingCallNotification = ({ callerName, onAccept, onReject }) => {
    return (
        <div className="flex flex-col items-center gap-4 p-4">
            <div className="text-lg font-semibold">
                Incoming video call from {callerName}
            </div>
            <div className="flex gap-4">
                <button
                    onClick={onAccept}
                    className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
                >
                    Accept
                </button>
                <button
                    onClick={onReject}
                    className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600"
                >
                    Reject
                </button>
            </div>
        </div>
    );
};

export default IncomingCallNotification; 