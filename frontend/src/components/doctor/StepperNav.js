import { VideoCameraIcon, ClipboardDocumentListIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

const STEPS = [
  { id: 0, label: "Camera",  Icon: VideoCameraIcon },
  { id: 1, label: "Actions", Icon: ClipboardDocumentListIcon },
  { id: 2, label: "Info",    Icon: InformationCircleIcon },
];

export default function StepperNav({ activeStep, onStepChange }) {
  return (
    <div className="flex flex-col bg-white h-full w-20 md:w-44 shrink-0 border-r border-gray-200 py-6 select-none">
      {STEPS.map(({ id, label, Icon }) => {
        const isActive = activeStep === id;
        return (
          <button
            key={id}
            onClick={() => onStepChange(id)}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 px-2 md:px-4 py-4 text-left transition-colors w-full
              ${isActive
                ? "bg-purple-50 border-l-4 border-purple-600 text-purple-700"
                : "border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
          >
            <div className={`flex items-center justify-center rounded-full w-8 h-8 shrink-0
              ${isActive ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500"}`}
            >
              <span className="text-xs font-bold">{id + 1}</span>
            </div>
            <div className="hidden md:flex flex-col">
              <span className={`text-xs font-semibold ${isActive ? "text-purple-700" : "text-gray-600"}`}>
                {label}
              </span>
              <Icon className={`h-4 w-4 mt-0.5 ${isActive ? "text-purple-500" : "text-gray-400"}`} />
            </div>
            <Icon className={`md:hidden h-5 w-5 ${isActive ? "text-purple-500" : "text-gray-400"}`} />
          </button>
        );
      })}
    </div>
  );
}
