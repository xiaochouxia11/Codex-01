# usrsctp_finish() joins the iterator and leaves MUST_EXIT/EXITED set. Clear
# those flags before starting a new iterator after a complete shutdown.
# The thread_proc guard in the upstream function still prevents live reinit.
set(path "${SCTP_SOURCE_DIR}/usrsctplib/netinet/sctp_bsd_addr.c")
file(READ "${path}" source)
set(before "\t/* Initialize global locks here, thus only once. */\n\tSCTP_ITERATOR_LOCK_INIT();")
set(after "\t/* Reset termination flags after a previous joined shutdown. */\n\tsctp_it_ctl.iterator_flags = 0;\n${before}")
string(FIND "${source}" "${after}" applied)
if(applied EQUAL -1)
    string(FIND "${source}" "${before}" found)
    if(found EQUAL -1)
        message(FATAL_ERROR "usrsctp iterator patch does not match the pinned source")
    endif()
    string(REPLACE "${before}" "${after}" source "${source}")
    file(WRITE "${path}" "${source}")
endif()
